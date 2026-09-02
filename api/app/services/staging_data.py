"""Remove private operational data from a database clone used for staging."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.audit import AuditLog
from app.models.contact_message import ContactMessage
from app.models.match import (
    DisciplineCase,
    DisciplineSanction,
    FanPlayerMatchVote,
    MatchBallEvent,
    MatchPlayerStat,
    MatchScorecardEditRequest,
)
from app.models.merchandise import MerchandiseOrder
from app.models.user import User


class UnsafeStagingTarget(ValueError):
    """Raised when a database has not been explicitly confirmed as staging."""


def database_name(database_url: str) -> str:
    name = make_url(database_url).database
    if not name:
        raise UnsafeStagingTarget("The staging database URL does not include a database name")
    return name


def assert_safe_staging_target(
    staging_database_url: str,
    *,
    confirmation: str,
    production_database_url: str | None = None,
) -> str:
    """Require the operator to type the exact database name before mutation."""
    staging_name = database_name(staging_database_url)
    if confirmation != staging_name:
        raise UnsafeStagingTarget(
            f"Confirmation must exactly match the target database name: {staging_name}",
        )

    if production_database_url:
        staging = make_url(staging_database_url).render_as_string(hide_password=False)
        production = make_url(production_database_url).render_as_string(hide_password=False)
        if staging == production:
            raise UnsafeStagingTarget("The staging and production database URLs are identical")

    return staging_name


@dataclass(frozen=True)
class AnonymizationSummary:
    users: int
    contact_messages: int
    merchandise_orders: int
    fan_votes: int
    audit_logs: int
    discipline_cases: int
    scorecard_edit_requests: int
    ball_notes: int
    player_stat_notes: int


def anonymize_staging_data(
    db: Session,
    *,
    admin_email: str,
    admin_password: str,
) -> AnonymizationSummary:
    """Anonymise a cloned database and create one isolated staging admin."""
    if len(admin_password) < 12:
        raise ValueError("The staging administrator password must be at least 12 characters")

    users = list(db.scalars(select(User).order_by(User.id)))
    disabled_password = hash_password("staging-disabled-account-password")
    for user in users:
        user.email = f"staging-user-{user.id}@example.invalid"
        user.full_name = f"Staging user {user.id}"
        user.hashed_password = disabled_password
        user.is_active = False

    contact_messages = list(db.scalars(select(ContactMessage).order_by(ContactMessage.id)))
    for message in contact_messages:
        message.full_name = f"Staging contact {message.id}"
        message.email = f"contact-{message.id}@example.invalid"
        message.phone = None
        message.message = "Redacted from the staging dataset."

    merchandise_orders = list(db.scalars(select(MerchandiseOrder).order_by(MerchandiseOrder.id)))
    for order in merchandise_orders:
        order.customer_name = f"Staging customer {order.id}"
        order.phone = "+263000000000"
        order.email = f"order-{order.id}@example.invalid"
        order.notes = "Redacted from the staging dataset."

    fan_votes = list(db.scalars(select(FanPlayerMatchVote).order_by(FanPlayerMatchVote.id)))
    for vote in fan_votes:
        vote.voter_key = f"staging-voter-{vote.id}"

    audit_logs = list(db.scalars(select(AuditLog).order_by(AuditLog.id)))
    for audit in audit_logs:
        audit.summary = f"Redacted staging audit event {audit.id}."

    discipline_cases = list(db.scalars(select(DisciplineCase).order_by(DisciplineCase.id)))
    for case in discipline_cases:
        case.summary = f"Redacted staging discipline case {case.id}."
        case.evidence_notes = None
        case.decision_text = None
        case.public_summary = None

    discipline_sanctions = list(
        db.scalars(select(DisciplineSanction).order_by(DisciplineSanction.id)),
    )
    for sanction in discipline_sanctions:
        sanction.notes = None

    edit_requests = list(
        db.scalars(select(MatchScorecardEditRequest).order_by(MatchScorecardEditRequest.id)),
    )
    for request in edit_requests:
        request.reason = "Redacted from the staging dataset."
        request.decision_note = None

    ball_events = list(db.scalars(select(MatchBallEvent).order_by(MatchBallEvent.id)))
    ball_note_count = 0
    for event in ball_events:
        if event.notes:
            ball_note_count += 1
            event.notes = "Staging commentary redacted."

    player_stats = list(db.scalars(select(MatchPlayerStat).order_by(MatchPlayerStat.id)))
    player_stat_note_count = 0
    for stat in player_stats:
        if stat.notes:
            player_stat_note_count += 1
            stat.notes = None

    db.flush()
    db.add(
        User(
            email=admin_email.strip().lower(),
            hashed_password=hash_password(admin_password),
            full_name="Staging administrator",
            role="super_admin",
            is_active=True,
        ),
    )
    db.commit()

    return AnonymizationSummary(
        users=len(users),
        contact_messages=len(contact_messages),
        merchandise_orders=len(merchandise_orders),
        fan_votes=len(fan_votes),
        audit_logs=len(audit_logs),
        discipline_cases=len(discipline_cases),
        scorecard_edit_requests=len(edit_requests),
        ball_notes=ball_note_count,
        player_stat_notes=player_stat_note_count,
    )
