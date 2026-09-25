from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_supporter, get_optional_supporter
from app.api.pagination import PageParams, paginate_select, to_paginated
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, decode_token_safe, hash_password, verify_password
from app.db.session import get_db
from app.models.merchandise import MerchandiseOrder
from app.models.player import Player
from app.models.supporter import (
    FanEngagementEvent,
    FanNotification,
    FanPushDevice,
    SupporterAccount,
    SupporterConsentEvent,
    SupporterEmailVerification,
    SupporterPlayerFollow,
    SupporterTeamFollow,
)
from app.models.team import Team
from app.schemas.merchandise import MerchandiseOrderOut
from app.schemas.supporters import (
    FanEngagementEventIn,
    FanNotificationOut,
    FanPushDeviceIn,
    FanPushDeviceOut,
    SupporterAccountOut,
    SupporterAccountPatchIn,
    SupporterEmailVerificationIn,
    SupporterFollowsOut,
    SupporterFollowOut,
    SupporterLoginIn,
    SupporterRegisterIn,
    SupporterRegistrationOut,
    SupporterTokenOut,
    SupporterTokenRefreshIn,
    SupporterVerificationResendIn,
)
from app.services.supporter_email import SupporterEmailDeliveryError, send_supporter_verification_email

router = APIRouter(prefix="/supporters", tags=["supporters"])
DUMMY_PASSWORD_HASH = "$2b$12$VJp5D0ojQ2kQiN1lCyUG0.qHHQ0WWCOmc5GWzqVJibhdMb4RiAGMK"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalise_email(value: str) -> str:
    return value.strip().casefold()


def _tokens(account: SupporterAccount) -> SupporterTokenOut:
    subject = f"supporter:{account.id}"
    claims = {"account_type": "supporter"}
    return SupporterTokenOut(
        access_token=create_access_token(subject, extra_claims=claims),
        refresh_token=create_refresh_token(subject, extra_claims=claims),
    )


def _record_initial_consents(db: Session, account: SupporterAccount, body: SupporterRegisterIn) -> None:
    values = {
        "terms": True,
        "privacy": True,
        "marketing": body.marketing_consent,
        "push": body.push_consent,
        "analytics": body.analytics_consent,
    }
    db.add_all(
        SupporterConsentEvent(
            supporter_id=account.id,
            consent_type=consent_type,
            granted=granted,
            policy_version=body.policy_version,
            source="website",
        )
        for consent_type, granted in values.items()
    )


def _create_email_verification(db: Session, account: SupporterAccount) -> str:
    """Replace outstanding links so only the newest verification email can be used."""

    db.execute(
        delete(SupporterEmailVerification).where(
            SupporterEmailVerification.supporter_id == account.id,
            SupporterEmailVerification.consumed_at.is_(None),
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(
        SupporterEmailVerification(
            supporter_id=account.id,
            token_hash=sha256(token.encode()).hexdigest(),
            expires_at=_now() + timedelta(hours=24),
        )
    )
    return token


def _send_email_verification(account: SupporterAccount, token: str) -> None:
    try:
        send_supporter_verification_email(
            get_settings(),
            recipient=account.email,
            display_name=account.display_name,
            token=token,
        )
    except SupporterEmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "verification_delivery_unavailable",
                "message": "We could not send the verification email. Please try again shortly.",
            },
        ) from exc


@router.post("/auth/register", response_model=SupporterRegistrationOut, status_code=status.HTTP_201_CREATED)
def register_supporter(body: SupporterRegisterIn, db: Session = Depends(get_db)) -> SupporterRegistrationOut:
    current = _now()
    account = SupporterAccount(
        email=_normalise_email(body.email),
        hashed_password=hash_password(body.password),
        display_name=body.display_name.strip(),
        phone=body.phone.strip(),
        terms_accepted_at=current,
        privacy_accepted_at=current,
        policy_version=body.policy_version.strip(),
        marketing_consent=body.marketing_consent,
        push_consent=body.push_consent,
        analytics_consent=body.analytics_consent,
        consent_updated_at=current,
    )
    db.add(account)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "email_in_use", "message": "A supporter account already uses this email."},
        ) from exc
    _record_initial_consents(db, account, body)
    verification_token = _create_email_verification(db, account)
    db.commit()
    _send_email_verification(account, verification_token)
    return SupporterRegistrationOut(message="Check your inbox to verify your email before signing in.")


@router.post("/auth/verify-email", response_model=SupporterRegistrationOut)
def verify_supporter_email(
    body: SupporterEmailVerificationIn,
    db: Session = Depends(get_db),
) -> SupporterRegistrationOut:
    verification = db.scalar(
        select(SupporterEmailVerification).where(
            SupporterEmailVerification.token_hash == sha256(body.token.encode()).hexdigest(),
            SupporterEmailVerification.consumed_at.is_(None),
            SupporterEmailVerification.expires_at >= _now(),
        )
    )
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_verification", "message": "This verification link is invalid or has expired."},
        )
    account = db.get(SupporterAccount, verification.supporter_id)
    if account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_verification", "message": "This verification link is no longer available."},
        )
    current = _now()
    verification.consumed_at = current
    account.email_verified_at = current
    db.commit()
    return SupporterRegistrationOut(message="Email verified. You can now sign in and watch NPL broadcasts.")


@router.post("/auth/resend-verification", response_model=SupporterRegistrationOut, status_code=status.HTTP_202_ACCEPTED)
def resend_supporter_verification(
    body: SupporterVerificationResendIn,
    db: Session = Depends(get_db),
) -> SupporterRegistrationOut:
    account = db.scalar(select(SupporterAccount).where(SupporterAccount.email == _normalise_email(body.email)))
    if account is not None and account.is_active and account.email_verified_at is None:
        verification_token = _create_email_verification(db, account)
        db.commit()
        _send_email_verification(account, verification_token)
    return SupporterRegistrationOut(message="If an unverified account uses this email, we have sent a verification link.")


@router.post("/auth/login", response_model=SupporterTokenOut)
def login_supporter(body: SupporterLoginIn, db: Session = Depends(get_db)) -> SupporterTokenOut:
    account = db.scalar(select(SupporterAccount).where(SupporterAccount.email == _normalise_email(body.email)))
    password_matches = verify_password(
        body.password,
        account.hashed_password if account is not None else DUMMY_PASSWORD_HASH,
    )
    if account is None or not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Incorrect email or password."},
        )
    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "account_inactive", "message": "This supporter account is unavailable."},
        )
    if account.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "email_verification_required",
                "message": "Verify your email address before signing in. Check your inbox or request a new link.",
            },
        )
    account.last_login_at = _now()
    db.commit()
    return _tokens(account)


@router.post("/auth/refresh", response_model=SupporterTokenOut)
def refresh_supporter(body: SupporterTokenRefreshIn, db: Session = Depends(get_db)) -> SupporterTokenOut:
    payload = decode_token_safe(body.refresh_token)
    subject = str(payload.get("sub") or "") if payload else ""
    if (
        payload is None
        or payload.get("type") != "refresh"
        or payload.get("account_type") != "supporter"
        or not subject.startswith("supporter:")
    ):
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token."})
    try:
        supporter_id = int(subject.removeprefix("supporter:"))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token."}) from exc
    account = db.get(SupporterAccount, supporter_id)
    if account is None or not account.is_active or account.email_verified_at is None:
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token."})
    return _tokens(account)


@router.get("/me", response_model=SupporterAccountOut)
def supporter_me(account: SupporterAccount = Depends(get_current_supporter)) -> SupporterAccountOut:
    return SupporterAccountOut.model_validate(account)


@router.patch("/me", response_model=SupporterAccountOut)
def update_supporter_me(
    body: SupporterAccountPatchIn,
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> SupporterAccountOut:
    patch = body.model_dump(exclude_unset=True)
    if "display_name" in patch and patch["display_name"] is not None:
        account.display_name = patch["display_name"].strip()
    if "phone" in patch and patch["phone"] is not None:
        account.phone = patch["phone"].strip()
    for field, consent_type in (
        ("marketing_consent", "marketing"),
        ("push_consent", "push"),
        ("analytics_consent", "analytics"),
    ):
        if field in patch and patch[field] is not None and getattr(account, field) != patch[field]:
            setattr(account, field, patch[field])
            account.consent_updated_at = _now()
            db.add(
                SupporterConsentEvent(
                    supporter_id=account.id,
                    consent_type=consent_type,
                    granted=patch[field],
                    policy_version=account.policy_version,
                    source="website",
                )
            )
            if field == "push_consent" and not patch[field]:
                db.execute(
                    FanPushDevice.__table__.update()
                    .where(FanPushDevice.supporter_id == account.id)
                    .values(enabled=False)
                )
    new_password = patch.get("new_password")
    if new_password:
        if not patch.get("current_password") or not verify_password(patch["current_password"], account.hashed_password):
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_current_password", "message": "Your current password is incorrect."},
            )
        account.hashed_password = hash_password(new_password)
    db.commit()
    db.refresh(account)
    return SupporterAccountOut.model_validate(account)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_supporter_account(
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> Response:
    account.is_active = False
    account.email = f"deleted-{account.id}-{sha256(account.email.encode()).hexdigest()[:16]}@deleted.invalid"
    account.display_name = "Deleted supporter"
    account.hashed_password = hash_password(sha256(f"{account.id}:{_now().isoformat()}".encode()).hexdigest())
    account.marketing_consent = False
    account.push_consent = False
    account.analytics_consent = False
    account.consent_updated_at = _now()
    db.execute(delete(FanPushDevice).where(FanPushDevice.supporter_id == account.id))
    db.add_all(
        SupporterConsentEvent(
            supporter_id=account.id,
            consent_type=kind,
            granted=False,
            policy_version=account.policy_version,
            source="account_deletion",
        )
        for kind in ("marketing", "push", "analytics")
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/follows", response_model=SupporterFollowsOut)
def supporter_follows(
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> SupporterFollowsOut:
    team_rows = db.execute(
        select(SupporterTeamFollow, Team)
        .join(Team, Team.id == SupporterTeamFollow.team_id)
        .where(SupporterTeamFollow.supporter_id == account.id)
        .order_by(Team.name)
    ).all()
    player_rows = db.execute(
        select(SupporterPlayerFollow, Player)
        .join(Player, Player.id == SupporterPlayerFollow.player_id)
        .where(SupporterPlayerFollow.supporter_id == account.id)
        .order_by(Player.full_name)
    ).all()
    return SupporterFollowsOut(
        teams=[
            SupporterFollowOut(id=team.id, name=team.name, slug=team.slug, image_url=team.logo_url, followed_at=row.created_at)
            for row, team in team_rows
        ],
        players=[
            SupporterFollowOut(
                id=player.id,
                name=player.full_name,
                slug=player.slug,
                image_url=player.profile_photo_url,
                followed_at=row.created_at,
            )
            for row, player in player_rows
        ],
    )


def _set_follow(db: Session, *, account_id: int, kind: str, entity_id: int, enabled: bool) -> None:
    if kind == "team":
        model, entity_model, id_field = SupporterTeamFollow, Team, SupporterTeamFollow.team_id
        values = {"supporter_id": account_id, "team_id": entity_id}
    else:
        model, entity_model, id_field = SupporterPlayerFollow, Player, SupporterPlayerFollow.player_id
        values = {"supporter_id": account_id, "player_id": entity_id}
    if db.get(entity_model, entity_id) is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"{kind.title()} not found."})
    existing = db.scalar(select(model).where(model.supporter_id == account_id, id_field == entity_id))
    if enabled and existing is None:
        db.add(model(**values))
    elif not enabled and existing is not None:
        db.delete(existing)
    db.commit()


@router.put("/follows/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def follow_team(team_id: int, account: SupporterAccount = Depends(get_current_supporter), db: Session = Depends(get_db)) -> Response:
    _set_follow(db, account_id=account.id, kind="team", entity_id=team_id, enabled=True)
    return Response(status_code=204)


@router.delete("/follows/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_team(team_id: int, account: SupporterAccount = Depends(get_current_supporter), db: Session = Depends(get_db)) -> Response:
    _set_follow(db, account_id=account.id, kind="team", entity_id=team_id, enabled=False)
    return Response(status_code=204)


@router.put("/follows/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def follow_player(player_id: int, account: SupporterAccount = Depends(get_current_supporter), db: Session = Depends(get_db)) -> Response:
    _set_follow(db, account_id=account.id, kind="player", entity_id=player_id, enabled=True)
    return Response(status_code=204)


@router.delete("/follows/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_player(player_id: int, account: SupporterAccount = Depends(get_current_supporter), db: Session = Depends(get_db)) -> Response:
    _set_follow(db, account_id=account.id, kind="player", entity_id=player_id, enabled=False)
    return Response(status_code=204)


@router.post("/devices", response_model=FanPushDeviceOut)
def register_push_device(
    body: FanPushDeviceIn,
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> FanPushDeviceOut:
    if not account.push_consent:
        raise HTTPException(
            status_code=400,
            detail={"code": "push_consent_required", "message": "Enable match notifications before registering a device."},
        )
    token_hash = sha256(body.device_token.encode()).hexdigest()
    current = _now()
    device = db.scalar(select(FanPushDevice).where(FanPushDevice.device_token_hash == token_hash))
    if device is None:
        device = FanPushDevice(
            supporter_id=account.id,
            provider=body.provider,
            platform=body.platform,
            device_token=body.device_token,
            device_token_hash=token_hash,
            last_seen_at=current,
        )
        db.add(device)
    else:
        device.supporter_id = account.id
        device.provider = body.provider
        device.platform = body.platform
        device.device_token = body.device_token
        device.enabled = True
        device.last_seen_at = current
        device.last_error = None
    db.commit()
    db.refresh(device)
    return FanPushDeviceOut.model_validate(device)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_push_device(
    device_id: int,
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> Response:
    device = db.scalar(
        select(FanPushDevice).where(FanPushDevice.id == device_id, FanPushDevice.supporter_id == account.id)
    )
    if device is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Device not found."})
    db.delete(device)
    db.commit()
    return Response(status_code=204)


@router.get("/notifications", response_model=dict)
def supporter_notifications(
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
) -> dict:
    rows, total = paginate_select(
        db,
        select(FanNotification)
        .where(FanNotification.supporter_id == account.id)
        .order_by(FanNotification.created_at.desc()),
        page=page_params.page,
        page_size=page_params.page_size,
    )
    return to_paginated(
        [FanNotificationOut.model_validate(row) for row in rows], total, page_params.page, page_params.page_size
    ).model_dump()


@router.post("/notifications/{notification_id}/read", response_model=FanNotificationOut)
def mark_notification_read(
    notification_id: int,
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> FanNotificationOut:
    row = db.scalar(
        select(FanNotification).where(
            FanNotification.id == notification_id,
            FanNotification.supporter_id == account.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Notification not found."})
    row.read_at = row.read_at or _now()
    db.commit()
    db.refresh(row)
    return FanNotificationOut.model_validate(row)


@router.get("/orders", response_model=list[MerchandiseOrderOut])
def supporter_orders(
    account: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> list[MerchandiseOrderOut]:
    rows = db.scalars(
        select(MerchandiseOrder)
        .where(MerchandiseOrder.supporter_id == account.id)
        .order_by(MerchandiseOrder.created_at.desc())
    ).all()
    return [MerchandiseOrderOut.model_validate(row) for row in rows]


@router.post("/engagement", status_code=status.HTTP_204_NO_CONTENT)
def record_engagement(
    body: FanEngagementEventIn,
    account: SupporterAccount | None = Depends(get_optional_supporter),
    db: Session = Depends(get_db),
) -> Response:
    if account is not None and not account.analytics_consent:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    settings = get_settings()
    anonymous_hash = None
    if account is None and body.anonymous_id:
        anonymous_hash = hmac.new(
            settings.secret_key.encode(), body.anonymous_id.encode(), digestmod="sha256"
        ).hexdigest()
    if account is None and anonymous_hash is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    db.add(
        FanEngagementEvent(
            supporter_id=account.id if account else None,
            anonymous_id_hash=anonymous_hash,
            event_type=body.event_type,
            entity_type=body.entity_type,
            entity_id=body.entity_id,
            source=body.source,
            properties=body.properties,
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
