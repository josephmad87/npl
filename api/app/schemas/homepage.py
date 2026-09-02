from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.players import PlayerMatchAppearanceOut


class HomepageArticleOut(ORMModel):
    id: int
    title: str
    slug: str
    excerpt: str | None = None
    featured_image_url: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None


class HomepageTeamOut(ORMModel):
    id: int
    name: str
    slug: str
    category: str | None = None
    short_name: str | None = None
    logo_url: str | None = None


class HomepagePlayerOut(ORMModel):
    id: int
    full_name: str
    slug: str
    team_id: int
    category: str | None = None
    role: str | None = None
    profile_photo_url: str | None = None


class HomepageLeagueOut(ORMModel):
    id: int
    name: str
    slug: str


class HomepageSeasonOut(ORMModel):
    id: int
    league_id: int
    name: str
    slug: str
    league: HomepageLeagueOut


class HomepageMatchResultOut(ORMModel):
    winning_team_id: int | None = None
    outcome: str = "win"
    margin_text: str | None = None
    score_summary: str | None = None
    innings_breakdown: str | None = None
    player_of_match_player_id: int | None = None
    home_allotted_overs: Decimal | None = None
    away_allotted_overs: Decimal | None = None


class HomepageMatchOut(ORMModel):
    id: int
    season_id: int | None = None
    match_overs: Decimal | None = None
    category: str | None = None
    home_team_id: int
    away_team_id: int
    title: str | None = None
    venue: str | None = None
    match_date: date | None = None
    start_time: datetime | None = None
    status: str
    fixture_stage: str | None = None
    home_team_placeholder: str | None = None
    away_team_placeholder: str | None = None
    cover_image_url: str | None = None
    result: HomepageMatchResultOut | None = None
    season: HomepageSeasonOut | None = None


class HomepageGalleryOut(ORMModel):
    id: int
    title: str
    slug: str | None = None
    description: str | None = None
    media_type: str
    file_url: str
    thumbnail_url: str | None = None


class HomepageSponsorOut(ORMModel):
    id: int
    name: str
    image_url: str
    link_url: str | None = None
    team_id: int | None = None
    team_name: str | None = None


class HomepageOut(BaseModel):
    generated_at: datetime
    news: list[HomepageArticleOut] = Field(default_factory=list)
    fixtures: list[HomepageMatchOut] = Field(default_factory=list)
    results: list[HomepageMatchOut] = Field(default_factory=list)
    teams: list[HomepageTeamOut] = Field(default_factory=list)
    spotlight_teams: list[HomepageTeamOut] = Field(default_factory=list)
    spotlight_players: list[HomepagePlayerOut] = Field(default_factory=list)
    spotlight_player_appearances: list[PlayerMatchAppearanceOut] = Field(default_factory=list)
    gallery: list[HomepageGalleryOut] = Field(default_factory=list)
    sponsors: list[HomepageSponsorOut] = Field(default_factory=list)


class NavigationLeagueOut(ORMModel):
    id: int
    name: str
    slug: str
    category: str


class NavigationSeasonOut(ORMModel):
    id: int
    name: str
    slug: str
    league_slug: str
    league_category: str


class NavigationOut(BaseModel):
    teams: list[HomepageTeamOut] = Field(default_factory=list)
    leagues: list[NavigationLeagueOut] = Field(default_factory=list)
    seasons: list[NavigationSeasonOut] = Field(default_factory=list)
