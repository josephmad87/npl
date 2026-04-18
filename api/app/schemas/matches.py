from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class MatchBase(BaseModel):
    season_id: int | None = None
    category: str = Field(min_length=1, max_length=32)
    home_team_id: int
    away_team_id: int
    title: str | None = None
    venue: str | None = None
    match_date: date | None = None
    start_time: datetime | None = None
    toss_info: str | None = None
    umpires: str | None = None
    status: str = "scheduled"
    description: str | None = None
    cover_image_url: str | None = None


class MatchCreate(MatchBase):
    pass


class MatchUpdate(BaseModel):
    season_id: int | None = None
    category: str | None = None
    home_team_id: int | None = None
    away_team_id: int | None = None
    title: str | None = None
    venue: str | None = None
    match_date: date | None = None
    start_time: datetime | None = None
    toss_info: str | None = None
    umpires: str | None = None
    status: str | None = None
    description: str | None = None
    cover_image_url: str | None = None


class MatchPlayerStatIn(BaseModel):
    """One scorecard row per player per match (batting + bowling + fielding columns)."""

    player_id: int = Field(ge=1)
    team_id: int = Field(ge=1)
    lineup_order: int = Field(default=0, ge=0)
    runs: int = Field(default=0, ge=0)
    balls_faced: int = Field(default=0, ge=0)
    fours: int = Field(default=0, ge=0)
    sixes: int = Field(default=0, ge=0)
    dismissal: str | None = Field(default=None, max_length=128)
    overs: float | None = Field(default=None, ge=0, le=99.99)
    maidens: int = Field(default=0, ge=0)
    runs_conceded: int = Field(default=0, ge=0)
    wickets: int = Field(default=0, ge=0)
    catches: int = Field(default=0, ge=0)
    stumpings: int = Field(default=0, ge=0)
    run_outs: int = Field(default=0, ge=0)
    notes: str | None = None


class MatchPlayerStatOut(ORMModel):
    id: int
    match_id: int
    player_id: int
    team_id: int
    lineup_order: int
    runs: int
    balls_faced: int
    fours: int
    sixes: int
    dismissal: str | None
    overs: Decimal | None
    maidens: int
    runs_conceded: int
    wickets: int
    catches: int
    stumpings: int
    run_outs: int
    notes: str | None


class MatchResultIn(BaseModel):
    winning_team_id: int | None = None
    margin_text: str | None = None
    score_summary: str | None = None
    innings_breakdown: str | None = None
    top_performers: str | None = None
    player_of_match_player_id: int | None = None
    result_status: str = "official"
    match_report: str | None = None
    player_stats: list[MatchPlayerStatIn] = Field(default_factory=list)


class MatchResultOut(ORMModel):
    id: int
    match_id: int
    winning_team_id: int | None
    margin_text: str | None
    score_summary: str | None
    innings_breakdown: str | None
    top_performers: str | None
    player_of_match_player_id: int | None
    result_status: str
    match_report: str | None


class LeagueBriefOut(ORMModel):
    id: int
    name: str
    slug: str


class SeasonBriefOut(ORMModel):
    id: int
    league_id: int
    name: str
    slug: str
    league: LeagueBriefOut


class MatchDetailOut(ORMModel):
    id: int
    season_id: int | None
    category: str
    home_team_id: int
    away_team_id: int
    title: str | None
    venue: str | None
    match_date: date | None
    start_time: datetime | None
    toss_info: str | None
    umpires: str | None
    status: str
    description: str | None
    cover_image_url: str | None
    result: MatchResultOut | None
    player_stats: list[MatchPlayerStatOut] = Field(default_factory=list)
    season: SeasonBriefOut | None = None
