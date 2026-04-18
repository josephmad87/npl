from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.seasons import SeasonSummaryOut


class LeagueBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str = Field(min_length=1, max_length=32)
    logo_url: str | None = None
    banner_url: str | None = None


class LeagueCreate(LeagueBase):
    pass


class LeagueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=32)
    logo_url: str | None = None
    banner_url: str | None = None


class LeagueOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    category: str
    logo_url: str | None
    banner_url: str | None


class LeaguePublicOut(LeagueOut):
    """Public league card (no roster; use seasons endpoints)."""

    pass


class LeagueDetailPublicOut(LeagueOut):
    """League with its seasons (summaries only)."""

    seasons: list[SeasonSummaryOut] = Field(default_factory=list)
