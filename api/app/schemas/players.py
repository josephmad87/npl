from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PlayerMatchAppearanceOut(BaseModel):
    """One scorecard line for this player, with match context for admin UI."""

    stat_id: int
    match_id: int
    match_date: date | None
    venue: str | None
    status: str
    home_team_id: int
    away_team_id: int
    home_team_name: str
    away_team_name: str
    league_name: str | None
    season_name: str | None
    season_id: int | None
    side_team_id: int
    runs: int
    balls_faced: int
    fours: int
    sixes: int
    dismissal: str | None
    overs: float | None
    maidens: int
    runs_conceded: int
    wickets: int
    catches: int
    stumpings: int
    run_outs: int
    notes: str | None


class PlayerBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    profile_photo_url: str | None = None
    team_id: int
    category: str = Field(min_length=1, max_length=32)
    date_of_birth: date | None = None
    nationality: str | None = None
    role: str | None = None
    batting_style: str | None = None
    bowling_style: str | None = None
    jersey_number: int | None = None
    bio: str | None = None
    debut_info: str | None = None
    status: str = "active"


class PlayerStatsPatch(BaseModel):
    matches_played: int = 0
    runs_scored: int = 0
    batting_average: float | None = None
    strike_rate: float | None = None
    highest_score: int | None = None
    wickets_taken: int = 0
    bowling_average: float | None = None
    economy_rate: float | None = None
    best_bowling: str | None = None
    catches: int = 0
    stumpings: int = 0
    player_of_match_awards: int = 0


class PlayerCreate(PlayerBase, PlayerStatsPatch):
    pass


class PlayerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    profile_photo_url: str | None = None
    team_id: int | None = None
    category: str | None = None
    date_of_birth: date | None = None
    nationality: str | None = None
    role: str | None = None
    batting_style: str | None = None
    bowling_style: str | None = None
    jersey_number: int | None = None
    bio: str | None = None
    debut_info: str | None = None
    status: str | None = None
    matches_played: int | None = None
    runs_scored: int | None = None
    batting_average: float | None = None
    strike_rate: float | None = None
    highest_score: int | None = None
    wickets_taken: int | None = None
    bowling_average: float | None = None
    economy_rate: float | None = None
    best_bowling: str | None = None
    catches: int | None = None
    stumpings: int | None = None
    player_of_match_awards: int | None = None


class PlayerOut(ORMModel):
    id: int
    full_name: str
    slug: str
    profile_photo_url: str | None
    team_id: int
    category: str
    date_of_birth: date | None
    nationality: str | None
    role: str | None
    batting_style: str | None
    bowling_style: str | None
    jersey_number: int | None
    bio: str | None
    debut_info: str | None
    status: str
    matches_played: int
    runs_scored: int
    batting_average: float | None
    strike_rate: float | None
    highest_score: int | None
    wickets_taken: int
    bowling_average: float | None
    economy_rate: float | None
    best_bowling: str | None
    catches: int
    stumpings: int
    player_of_match_awards: int
