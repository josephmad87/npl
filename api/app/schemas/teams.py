from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class TeamBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=32)
    short_name: str | None = Field(default=None, max_length=64)
    logo_url: str | None = None
    cover_image_url: str | None = None
    description: str | None = None
    home_ground: str | None = None
    coach: str | None = None
    captain: str | None = None
    year_founded: int | None = None
    status: str = "active"
    social_links: dict | None = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=32)
    short_name: str | None = None
    logo_url: str | None = None
    cover_image_url: str | None = None
    description: str | None = None
    home_ground: str | None = None
    coach: str | None = None
    captain: str | None = None
    year_founded: int | None = None
    status: str | None = None
    social_links: dict | None = None


class TeamOut(ORMModel):
    id: int
    name: str
    slug: str
    category: str
    short_name: str | None
    logo_url: str | None
    cover_image_url: str | None
    description: str | None
    home_ground: str | None
    coach: str | None
    captain: str | None
    year_founded: int | None
    status: str
    social_links: dict | None
