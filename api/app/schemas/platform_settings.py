from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationHook(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1, max_length=2000)


class PlatformSettingsOut(BaseModel):
    site_name: str
    default_season: str
    media_cdn_base_url: str
    feature_flags: dict[str, Any]
    notification_hooks: list[dict[str, Any]]
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlatformSettingsPatch(BaseModel):
    site_name: str | None = Field(default=None, max_length=200)
    default_season: str | None = Field(default=None, max_length=120)
    media_cdn_base_url: str | None = Field(default=None, max_length=1000)
    feature_flags: dict[str, Any] | None = None
    notification_hooks: list[NotificationHook] | None = None
