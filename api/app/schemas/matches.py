from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

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
    is_published: bool = True
    fixture_stage: str | None = None
    home_team_source: str | None = None
    away_team_source: str | None = None
    home_team_placeholder: str | None = None
    away_team_placeholder: str | None = None
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
    is_published: bool | None = None
    fixture_stage: str | None = None
    home_team_source: str | None = None
    away_team_source: str | None = None
    home_team_placeholder: str | None = None
    away_team_placeholder: str | None = None
    description: str | None = None
    cover_image_url: str | None = None


class MatchPlayerStatIn(BaseModel):
    """One scorecard row per player per match (batting + bowling + fielding columns)."""

    player_id: int = Field(ge=1)
    team_id: int = Field(ge=1)
    lineup_order: int = Field(default=0, ge=0)
    batting_order: int | None = Field(default=None, ge=0)
    bowling_order: int | None = Field(default=None, ge=0)
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
    batting_order: int | None
    bowling_order: int | None
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

class FanPlayerMatchVoteIn(BaseModel):
    player_id: int = Field(ge=1)


class FanPlayerMatchVoteChoiceOut(BaseModel):
    player_id: int
    player_name: str
    team_id: int
    votes: int = 0
    percentage: float = 0


class FanPlayerMatchVoteSummaryOut(BaseModel):
    match_id: int
    eligible: bool
    reason: str | None = None
    total_votes: int = 0
    voter_player_id: int | None = None
    choices: list[FanPlayerMatchVoteChoiceOut] = Field(default_factory=list)


class MatchScorerAssignmentIn(BaseModel):
    user_ids: list[int] = Field(default_factory=list)


class MatchSquadPlayerIn(BaseModel):
    player_id: int = Field(ge=1)
    role: str = Field(pattern="^(playing_xi|substitute|concussion_substitute)$")
    lineup_order: int = Field(default=0, ge=0)
    is_captain: bool = False
    is_wicketkeeper: bool = False


class MatchSquadTeamIn(BaseModel):
    team_id: int = Field(ge=1)
    players: list[MatchSquadPlayerIn] = Field(default_factory=list)


class MatchSquadSaveIn(BaseModel):
    teams: list[MatchSquadTeamIn] = Field(default_factory=list)


class MatchSquadPlayerOut(ORMModel):
    id: int
    match_id: int
    team_id: int
    player_id: int
    role: str
    lineup_order: int
    is_captain: bool
    is_wicketkeeper: bool
    created_by_user_id: int | None
    created_at: datetime
    updated_at: datetime


class MatchSquadTeamOut(BaseModel):
    team_id: int
    players: list[MatchSquadPlayerOut] = Field(default_factory=list)


class MatchSquadOut(BaseModel):
    match_id: int
    teams: list[MatchSquadTeamOut] = Field(default_factory=list)


class MatchScorerAssignmentOut(BaseModel):
    id: int
    match_id: int
    user_id: int
    user_email: str
    user_full_name: str | None = None
    assigned_by_user_id: int | None = None
    created_at: datetime


class ScorecardEditRequestIn(BaseModel):
    reason: str | None = Field(default=None, max_length=512)


class ScorecardEditRequestDecisionIn(BaseModel):
    approved: bool
    decision_note: str | None = Field(default=None, max_length=512)


class ScorecardEditRequestOut(BaseModel):
    id: int
    match_id: int
    requested_by_user_id: int
    requester_email: str
    requester_full_name: str | None = None
    status: str
    reason: str | None = None
    decision_note: str | None = None
    requested_at: datetime
    reviewed_by_user_id: int | None = None
    reviewed_at: datetime | None = None
    access_until: datetime | None = None
    home_team_id: int
    away_team_id: int




class MatchLiveSetupIn(BaseModel):
    toss_winner_team_id: int = Field(ge=1)
    toss_decision: str = Field(pattern="^(bat|bowl)$")
    batting_first_team_id: int = Field(ge=1)
    match_overs: Decimal | None = None
    umpire_1: str | None = Field(default=None, max_length=128)
    umpire_2: str | None = Field(default=None, max_length=128)
    reserve_umpire: str | None = Field(default=None, max_length=128)


class LiveMatchConditionsIn(BaseModel):
    match_overs: Decimal | None = Field(default=None, ge=0, le=50)
    innings: int = Field(ge=1, le=2)
    clear_dls: bool = False


class LiveScoreStartIn(BaseModel):
    batting_team_id: int = Field(ge=1)
    bowling_team_id: int = Field(ge=1)


class LiveScoreCompleteIn(BaseModel):
    status: str = Field(default="completed", pattern="^(completed|abandoned|cancelled)$")
    match_overs: Decimal | None = None


class ScoringSessionAcquireIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=128)
    device_label: str | None = Field(default=None, max_length=255)
    force_takeover: bool = False
    takeover_reason: str | None = Field(default=None, max_length=512)

    @model_validator(mode="after")
    def takeover_has_reason(self) -> "ScoringSessionAcquireIn":
        if self.force_takeover and len((self.takeover_reason or "").strip()) < 5:
            raise ValueError("A takeover reason of at least 5 characters is required")
        return self


class ScoringSessionOut(BaseModel):
    id: int
    match_id: int
    owner_user_id: int
    owner_name: str
    device_id: str
    device_label: str | None = None
    status: str
    acquired_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    is_owner: bool = False
    session_token: str | None = None


class LiveBallEventIn(BaseModel):
    client_event_id: str | None = Field(default=None, min_length=8, max_length=64)
    innings: int = Field(ge=1, le=4)
    over_number: int = Field(ge=0, le=999)
    ball_number: int = Field(ge=0, le=12)
    batting_team_id: int = Field(ge=1)
    bowling_team_id: int = Field(ge=1)
    striker_player_id: int = Field(ge=1)
    non_striker_player_id: int | None = Field(default=None, ge=1)
    bowler_player_id: int = Field(ge=1)
    runs_batter: int = Field(default=0, ge=0, le=12)
    runs_extras: int = Field(default=0, ge=0, le=20)
    extras_type: str | None = Field(default=None, max_length=32)
    is_legal_delivery: bool = True
    completed_runs: int = Field(default=0, ge=0, le=12)
    boundary_runs: int = Field(default=0, ge=0, le=6)
    boundary_type: str | None = Field(default=None, max_length=32)
    penalty_runs_batting: int = Field(default=0, ge=0, le=10)
    penalty_runs_fielding: int = Field(default=0, ge=0, le=10)
    short_runs: int = Field(default=0, ge=0, le=6)
    leg_bye_attempted: bool = False
    over_complete_override: bool | None = None
    is_dead_ball: bool = False
    wicket_type: str | None = Field(default=None, max_length=64)
    wicket_player_id: int | None = Field(default=None, ge=1)
    fielder_player_id: int | None = Field(default=None, ge=1)
    replacement_player_id: int | None = Field(default=None, ge=1)
    wicket_end: str | None = Field(default=None, pattern="^(striker|non_striker)$")
    batters_crossed: bool = False
    dismissal_text: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class LiveBallEventOut(ORMModel):
    id: int
    match_id: int
    innings: int
    over_number: int
    ball_number: int
    batting_team_id: int
    bowling_team_id: int
    striker_player_id: int
    non_striker_player_id: int | None
    bowler_player_id: int
    runs_batter: int
    runs_extras: int
    extras_type: str | None
    is_legal_delivery: bool
    completed_runs: int = 0
    boundary_runs: int = 0
    boundary_type: str | None = None
    penalty_runs_batting: int = 0
    penalty_runs_fielding: int = 0
    short_runs: int = 0
    leg_bye_attempted: bool = False
    over_complete_override: bool | None = None
    is_dead_ball: bool = False
    wicket_type: str | None
    wicket_player_id: int | None
    fielder_player_id: int | None
    replacement_player_id: int | None = None
    wicket_end: str | None = None
    batters_crossed: bool = False
    dismissal_text: str | None
    notes: str | None
    client_event_id: str | None = None
    sequence_number: int
    created_by_user_id: int | None
    created_at: datetime
    updated_at: datetime
    score_version: int | None = None


class LiveScoreInningsSummaryOut(BaseModel):
    innings: int
    batting_team_id: int
    bowling_team_id: int
    runs: int = 0
    wickets: int = 0
    legal_balls: int = 0
    overs_label: str = "0.0"
    last_six: list[str] = Field(default_factory=list)
    last_event: LiveBallEventOut | None = None


class LiveScoreStateOut(BaseModel):
    match_id: int
    status: str
    match_overs: Decimal | None = None
    revised_target_runs: int | None = None
    dls_par_score: int | None = None
    current_innings: int | None = None
    summaries: list[LiveScoreInningsSummaryOut] = Field(default_factory=list)
    events: list[LiveBallEventOut] = Field(default_factory=list)
    undone_event: LiveBallEventOut | None = None
    scorecard_finalized_at: datetime | None = None
    scorecard_locks_at: datetime | None = None
    scorecard_locked: bool = False
    can_edit_scorecard: bool = True
    edit_request_status: str | None = None
    edit_request_decision_note: str | None = None
    edit_access_until: datetime | None = None
    scoring_version: int = 0
    scorecard_reconciled_version: int = 0
    scorecard_reconciled_at: datetime | None = None
    scorecard_reconciliation_status: str = "in_sync"
    scoring_session: ScoringSessionOut | None = None


class MatchResultIn(BaseModel):
    outcome: str = Field(default="win", pattern="^(win|tie|no_result)$")
    winning_team_id: int | None = None
    batting_first_team_id: int | None = None
    margin_text: str | None = None
    score_summary: str | None = None
    innings_breakdown: str | None = None
    top_performers: str | None = None
    player_of_match_player_id: int | None = None
    result_status: str = "official"
    nrr_excluded: bool = False
    match_report: str | None = None
    home_allotted_overs: float = Field(default=40.0, ge=0, le=300)
    away_allotted_overs: float = Field(default=40.0, ge=0, le=300)
    home_extras_wides: int = Field(default=0, ge=0)
    home_extras_byes: int = Field(default=0, ge=0)
    home_extras_no_balls: int = Field(default=0, ge=0)
    home_extras_leg_byes: int = Field(default=0, ge=0)
    away_extras_wides: int = Field(default=0, ge=0)
    away_extras_byes: int = Field(default=0, ge=0)
    away_extras_no_balls: int = Field(default=0, ge=0)
    away_extras_leg_byes: int = Field(default=0, ge=0)
    player_stats: list[MatchPlayerStatIn] = Field(default_factory=list)


class MatchResultOut(ORMModel):
    id: int
    match_id: int
    outcome: str = "win"
    winning_team_id: int | None
    batting_first_team_id: int | None = None
    margin_text: str | None
    score_summary: str | None
    innings_breakdown: str | None
    top_performers: str | None
    player_of_match_player_id: int | None
    result_status: str
    nrr_excluded: bool = False
    match_report: str | None
    home_allotted_overs: Decimal = Decimal("40.0")
    away_allotted_overs: Decimal = Decimal("40.0")
    home_extras_wides: int = 0
    home_extras_byes: int = 0
    home_extras_no_balls: int = 0
    home_extras_leg_byes: int = 0
    away_extras_wides: int = 0
    away_extras_byes: int = 0
    away_extras_no_balls: int = 0
    away_extras_leg_byes: int = 0


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


class MatchBulkCancelIn(BaseModel):
    match_ids: list[int] = Field(min_length=1)


class DisciplineIncidentIn(BaseModel):
    category: str = Field(min_length=2, max_length=48)
    summary: str = Field(min_length=5, max_length=512)
    evidence_notes: str | None = None
    occurred_at: datetime | None = None
    confidentiality: str = Field(default="restricted", pattern="^(restricted|safeguarding)$")


class DisciplineCaseCreateIn(DisciplineIncidentIn):
    match_id: int | None = Field(default=None, ge=1)
    subject_team_id: int | None = Field(default=None, ge=1)
    subject_player_id: int | None = Field(default=None, ge=1)


class DisciplineSanctionIn(BaseModel):
    sanction_type: str = Field(min_length=2, max_length=48)
    team_id: int | None = Field(default=None, ge=1)
    player_id: int | None = Field(default=None, ge=1)
    points_delta: int = Field(default=0, ge=-100, le=100)
    fine_amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=8)
    match_count: int | None = Field(default=None, ge=1, le=100)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=512)


class DisciplineCaseDecisionIn(BaseModel):
    status: str = Field(pattern="^(under_review|decided|appealed|final|dismissed)$")
    decision_text: str | None = None
    public_summary: str | None = Field(default=None, max_length=512)
    appeal_due_at: datetime | None = None
    # An administrative award is a result override, never a replacement
    # scorecard. It excludes NRR unless explicitly overridden by the super admin.
    override_outcome: str | None = Field(default=None, pattern="^(win|tie|no_result)$")
    winning_team_id: int | None = Field(default=None, ge=1)
    margin_text: str | None = Field(default=None, max_length=255)
    nrr_excluded: bool = True
    sanctions: list[DisciplineSanctionIn] = Field(default_factory=list)


class DisciplineSanctionOut(ORMModel):
    id: int
    case_id: int
    sanction_type: str
    team_id: int | None = None
    player_id: int | None = None
    points_delta: int
    fine_amount: Decimal | None = None
    currency: str | None = None
    match_count: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: str
    notes: str | None = None
    created_at: datetime


class DisciplineCaseOut(ORMModel):
    id: int
    match_id: int | None = None
    subject_team_id: int | None = None
    subject_player_id: int | None = None
    category: str
    status: str
    confidentiality: str
    summary: str
    evidence_notes: str | None = None
    occurred_at: datetime | None = None
    reported_at: datetime
    reported_by_user_id: int | None = None
    decision_text: str | None = None
    public_summary: str | None = None
    appeal_due_at: datetime | None = None
    decided_at: datetime | None = None
    decided_by_user_id: int | None = None
    sanctions: list[DisciplineSanctionOut] = Field(default_factory=list)


class SeasonStandingAdjustmentOut(BaseModel):
    team_id: int
    points_delta: int
    reason: str


class MatchDetailOut(ORMModel):
    id: int
    season_id: int | None
    match_overs: Decimal | None = None
    revised_target_runs: int | None = None
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
    is_published: bool = True
    fixture_stage: str | None = None
    home_team_source: str | None = None
    away_team_source: str | None = None
    home_team_placeholder: str | None = None
    away_team_placeholder: str | None = None
    description: str | None
    cover_image_url: str | None
    scorecard_finalized_at: datetime | None = None
    scorecard_locks_at: datetime | None = None
    scorecard_locked: bool = False
    can_edit_scorecard: bool = True
    edit_request_status: str | None = None
    edit_request_decision_note: str | None = None
    edit_access_until: datetime | None = None
    result: MatchResultOut | None
    player_stats: list[MatchPlayerStatOut] = Field(default_factory=list)
    season: SeasonBriefOut | None = None


class PlayoffFixtureCreateIn(BaseModel):
    category: str = Field(default="mens", min_length=1, max_length=32)
    match_overs: Decimal = Field(default=Decimal("20.0"), gt=0, le=99)
    is_published: bool = False


class PublishDraftFixturesIn(BaseModel):
    season_id: int = Field(ge=1)
