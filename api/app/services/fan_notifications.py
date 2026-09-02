from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings
from app.models.match import Match
from app.models.supporter import FanNotification, FanPushDevice, SupporterAccount, SupporterTeamFollow


def _utc(value: datetime | None = None) -> datetime:
    current = value or datetime.now(timezone.utc)
    return current if current.tzinfo else current.replace(tzinfo=timezone.utc)


def _followers_for_match(db: Session, match: Match) -> list[SupporterAccount]:
    return list(
        db.scalars(
            select(SupporterAccount)
            .join(SupporterTeamFollow, SupporterTeamFollow.supporter_id == SupporterAccount.id)
            .where(
                SupporterAccount.is_active.is_(True),
                SupporterAccount.push_consent.is_(True),
                SupporterTeamFollow.team_id.in_([match.home_team_id, match.away_team_id]),
            )
            .distinct()
        ).all()
    )


def _queue_one(
    db: Session,
    *,
    supporter: SupporterAccount,
    match: Match,
    event_type: str,
    title: str,
    body: str,
    scheduled_for: datetime,
) -> bool:
    key = f"{event_type}:match:{match.id}:supporter:{supporter.id}"
    if db.scalar(select(FanNotification.id).where(FanNotification.idempotency_key == key)) is not None:
        return False
    try:
        with db.begin_nested():
            db.add(
                FanNotification(
                    supporter_id=supporter.id,
                    match_id=match.id,
                    event_type=event_type,
                    title=title,
                    body=body,
                    data={"match_id": match.id, "path": f"/matches/{match.id}"},
                    scheduled_for=scheduled_for,
                    status="pending",
                    idempotency_key=key,
                )
            )
            db.flush()
    except IntegrityError:
        return False
    return True


def queue_fan_match_notifications(db: Session, *, now: datetime | None = None) -> int:
    """Queue due 24-hour, one-hour and result alerts without creating duplicates.

    Run every 10–15 minutes. The windows deliberately overlap the cadence; the
    idempotency key guarantees one alert of each type per supporter and match.
    """

    current = _utc(now)
    future_cutoff = current + timedelta(hours=25)
    recent_result_cutoff = current - timedelta(days=2)
    matches = list(
        db.scalars(
            select(Match)
            .options(joinedload(Match.home_team), joinedload(Match.away_team), joinedload(Match.result))
            .where(
                Match.is_published.is_(True),
                or_(
                    and_(Match.start_time.is_not(None), Match.start_time > current, Match.start_time <= future_cutoff),
                    and_(
                        Match.status == "completed",
                        Match.scorecard_finalized_at.is_not(None),
                        Match.scorecard_finalized_at >= recent_result_cutoff,
                    ),
                ),
            )
        ).unique().all()
    )
    queued = 0
    for match in matches:
        followers = _followers_for_match(db, match)
        teams = f"{match.home_team.name} vs {match.away_team.name}"
        start_time = _utc(match.start_time) if match.start_time else None
        for supporter in followers:
            if start_time and match.status != "completed":
                seconds = (start_time - current).total_seconds()
                if 23 * 3600 + 30 * 60 <= seconds <= 25 * 3600:
                    queued += int(
                        _queue_one(
                            db,
                            supporter=supporter,
                            match=match,
                            event_type="match_24h",
                            title="Your team plays tomorrow",
                            body=f"{teams} starts in about 24 hours.",
                            scheduled_for=current,
                        )
                    )
                if 45 * 60 <= seconds <= 75 * 60:
                    queued += int(
                        _queue_one(
                            db,
                            supporter=supporter,
                            match=match,
                            event_type="match_1h",
                            title="Your team plays in one hour",
                            body=f"{teams} starts soon.",
                            scheduled_for=current,
                        )
                    )
            if match.status == "completed" and match.result is not None:
                result_text = match.result.score_summary or match.result.margin_text or "The result is now available."
                queued += int(
                    _queue_one(
                        db,
                        supporter=supporter,
                        match=match,
                        event_type="match_result",
                        title=f"Result: {teams}",
                        body=result_text,
                        scheduled_for=current,
                    )
                )
    db.commit()
    return queued


def dispatch_fan_notifications(
    db: Session,
    settings: Settings,
    *,
    now: datetime | None = None,
    limit: int = 250,
) -> tuple[int, int]:
    """Send due outbox rows through the configured push gateway.

    The gateway contract accepts one JSON object with ``notification`` and a
    ``devices`` array. Tokens stay server-side. If no gateway is configured,
    notifications remain pending and are still available in the in-app inbox.
    """

    if not settings.fan_push_gateway_url:
        return 0, 0
    current = _utc(now)
    rows = list(
        db.scalars(
            select(FanNotification)
            .where(FanNotification.status == "pending", FanNotification.scheduled_for <= current)
            .order_by(FanNotification.scheduled_for, FanNotification.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )
    sent = 0
    failed = 0
    for notification in rows:
        devices = list(
            db.scalars(
                select(FanPushDevice).where(
                    FanPushDevice.supporter_id == notification.supporter_id,
                    FanPushDevice.enabled.is_(True),
                )
            ).all()
        )
        if not devices:
            notification.status = "inbox_only"
            continue
        payload = {
            "notification": {
                "id": notification.id,
                "title": notification.title,
                "body": notification.body,
                "data": notification.data,
            },
            "devices": [
                {"provider": device.provider, "platform": device.platform, "token": device.device_token}
                for device in devices
            ],
        }
        headers = {"Content-Type": "application/json"}
        if settings.fan_push_gateway_token:
            headers["Authorization"] = f"Bearer {settings.fan_push_gateway_token}"
        request = Request(
            settings.fan_push_gateway_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        notification.attempts += 1
        try:
            with urlopen(request, timeout=10) as response:  # noqa: S310 - URL is deploy-time configuration
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"Push gateway returned HTTP {response.status}")
            notification.status = "sent"
            notification.sent_at = current
            notification.last_error = None
            sent += 1
        except (HTTPError, URLError, TimeoutError, RuntimeError) as exc:
            notification.last_error = str(exc)[:2000]
            if notification.attempts >= 5:
                notification.status = "failed"
            failed += 1
    db.commit()
    return sent, failed
