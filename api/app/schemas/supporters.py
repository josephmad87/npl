from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import ORMModel

EmailLike = Annotated[str, Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+$")]


class SupporterRegisterIn(BaseModel):
    email: EmailLike
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=255)
    accept_terms: bool
    accept_privacy: bool
    policy_version: str = Field(min_length=1, max_length=32)
    marketing_consent: bool = False
    push_consent: bool = False
    analytics_consent: bool = False

    @model_validator(mode="after")
    def required_consents(self) -> "SupporterRegisterIn":
        if not self.accept_terms or not self.accept_privacy:
            raise ValueError("The Terms and Privacy Policy must be accepted.")
        return self


class SupporterLoginIn(BaseModel):
    email: EmailLike
    password: str = Field(min_length=1, max_length=128)


class SupporterTokenRefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=4096)


class SupporterTokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class SupporterAccountOut(ORMModel):
    id: int
    email: str
    display_name: str
    email_verified_at: datetime | None
    policy_version: str
    marketing_consent: bool
    push_consent: bool
    analytics_consent: bool
    created_at: datetime


class SupporterAccountPatchIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    marketing_consent: bool | None = None
    push_consent: bool | None = None
    analytics_consent: bool | None = None
    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    new_password: str | None = Field(default=None, min_length=12, max_length=128)


class SupporterFollowOut(BaseModel):
    id: int
    name: str
    slug: str
    image_url: str | None = None
    followed_at: datetime


class SupporterFollowsOut(BaseModel):
    teams: list[SupporterFollowOut] = Field(default_factory=list)
    players: list[SupporterFollowOut] = Field(default_factory=list)


class FanPushDeviceIn(BaseModel):
    provider: str = Field(pattern="^(fcm|apns|web)$")
    platform: str = Field(pattern="^(ios|android|web)$")
    device_token: str = Field(min_length=16, max_length=4096)


class FanPushDeviceOut(BaseModel):
    id: int
    provider: str
    platform: str
    enabled: bool
    last_seen_at: datetime

    model_config = {"from_attributes": True}


class FanNotificationOut(ORMModel):
    id: int
    match_id: int | None
    event_type: str
    title: str
    body: str
    data: dict[str, Any]
    scheduled_for: datetime
    status: str
    sent_at: datetime | None
    read_at: datetime | None
    created_at: datetime


class FanEngagementEventIn(BaseModel):
    event_type: str = Field(
        pattern="^(page_view|match_view|team_view|player_view|product_view|add_to_order|order_submitted|notification_open)$"
    )
    entity_type: str | None = Field(default=None, pattern="^(match|team|player|product|order|notification)$")
    entity_id: int | None = Field(default=None, ge=1)
    anonymous_id: str | None = Field(default=None, min_length=8, max_length=128)
    source: str = Field(default="website", pattern="^(website|ios|android)$")
    properties: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("properties")
    @classmethod
    def cap_properties(cls, value: dict[str, str | int | float | bool | None]):
        if len(value) > 20:
            raise ValueError("No more than 20 event properties are allowed.")
        if any(len(str(key)) > 64 or len(str(item)) > 256 for key, item in value.items()):
            raise ValueError("Event property keys or values are too long.")
        return value


class FanEngagementReportOut(BaseModel):
    from_date: datetime
    to_date: datetime
    supporter_accounts: int
    marketing_opt_ins: int
    push_opt_ins: int
    team_follows: int
    player_follows: int
    votes: int
    notifications_queued: int
    notifications_sent: int
    notification_opens: int
    product_views: int
    orders_submitted: int
    orders_fulfilled: int
    order_conversion_rate: float
    top_followed_teams: list[dict[str, Any]]
    top_followed_players: list[dict[str, Any]]
    top_products: list[dict[str, Any]]
