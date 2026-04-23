from datetime import datetime

from pydantic import BaseModel, Field


class SponsorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    image_url: str = Field(default="", max_length=1024)
    team_id: int | None = None


class SponsorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    image_url: str | None = Field(default=None, max_length=1024)
    team_id: int | None = None


class SponsorOut(BaseModel):
    id: int
    name: str
    image_url: str
    team_id: int | None
    team_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
