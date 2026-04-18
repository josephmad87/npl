from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class SeasonBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: str = "upcoming"


class SeasonCreate(SeasonBase):
    team_ids: list[int] | None = None


class SeasonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    team_ids: list[int] | None = None


class SeasonOut(ORMModel):
    id: int
    league_id: int
    name: str
    slug: str
    start_date: date | None
    end_date: date | None
    status: str


class SeasonSummaryOut(ORMModel):
    """Season row without roster (for league overview and season lists)."""

    id: int
    league_id: int
    name: str
    slug: str
    start_date: date | None
    end_date: date | None
    status: str


class SeasonPublicOut(SeasonOut):
    team_ids: list[int] = Field(default_factory=list)
