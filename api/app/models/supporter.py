from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SupporterAccount(Base):
    """Public supporter identity, deliberately separate from privileged admin users."""

    __tablename__ = "supporter_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    privacy_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    marketing_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    push_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    analytics_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SupporterConsentEvent(Base):
    __tablename__ = "supporter_consent_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    consent_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="website", nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class SupporterTeamFollow(Base):
    __tablename__ = "supporter_team_follows"
    __table_args__ = (UniqueConstraint("supporter_id", "team_id", name="uq_supporter_team_follow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SupporterPlayerFollow(Base):
    __tablename__ = "supporter_player_follows"
    __table_args__ = (UniqueConstraint("supporter_id", "player_id", name="uq_supporter_player_follow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FanPushDevice(Base):
    __tablename__ = "fan_push_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    device_token: Mapped[str] = mapped_column(Text, nullable=False)
    device_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class FanNotification(Base):
    """Durable notification inbox and provider outbox."""

    __tablename__ = "fan_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    match_id: Mapped[int | None] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FanEngagementEvent(Base):
    __tablename__ = "fan_engagement_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supporter_id: Mapped[int | None] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="SET NULL"), index=True
    )
    anonymous_id_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(32), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    source: Mapped[str] = mapped_column(String(32), default="website", nullable=False)
    properties: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
