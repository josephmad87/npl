from decimal import Decimal
from types import SimpleNamespace

from app.api.v1.admin_routes import (
    _dismissal_text_for_live_event,
    _live_ball_label,
    _validate_live_ball_event,
)
from app.models.match import Match
from app.schemas.matches import (
    LiveBallEventIn,
    LiveMatchConditionsIn,
    LiveScoreCompleteIn,
    LiveScoreStateOut,
    MatchDetailOut,
    MatchLiveSetupIn,
)
from app.services.dls import cricket_overs_to_balls, dls_par_score, dls_resource_percentage


def test_live_match_setup_preserves_match_overs() -> None:
    body = MatchLiveSetupIn(
        toss_winner_team_id=1,
        toss_decision="bat",
        batting_first_team_id=1,
        match_overs="20.0",
    )

    assert body.match_overs == Decimal("20.0")


def test_live_score_complete_preserves_match_overs() -> None:
    body = LiveScoreCompleteIn(status="completed", match_overs="20.0")

    assert body.match_overs == Decimal("20.0")


def test_public_match_detail_exposes_match_overs() -> None:
    detail = MatchDetailOut(
        id=1,
        season_id=2,
        match_overs="40.0",
        category="mens",
        home_team_id=10,
        away_team_id=11,
        title=None,
        venue=None,
        match_date=None,
        start_time=None,
        toss_info=None,
        umpires=None,
        status="live",
        description=None,
        cover_image_url=None,
        result=None,
    )

    assert detail.match_overs == Decimal("40.0")


def test_match_model_maps_match_overs_column() -> None:
    assert "match_overs" in Match.__table__.columns
    assert Match.__table__.c.match_overs.nullable is False
    assert "revised_target_runs" in Match.__table__.columns
    assert "dls_team2_resource_percentage" in Match.__table__.columns


def test_live_conditions_preserve_revised_overs_and_target() -> None:
    body = LiveMatchConditionsIn(match_overs="35.0", revised_target_runs=186)

    assert body.match_overs == Decimal("35.0")
    assert body.revised_target_runs == 186


def test_dls_par_score_advances_with_balls_and_wickets() -> None:
    start = dls_par_score(
        revised_target_runs=186,
        allotted_overs="35.0",
        legal_balls=0,
        wickets_lost=0,
    )
    after_ten_overs = dls_par_score(
        revised_target_runs=186,
        allotted_overs="35.0",
        legal_balls=60,
        wickets_lost=1,
    )
    after_wicket = dls_par_score(
        revised_target_runs=186,
        allotted_overs="35.0",
        legal_balls=60,
        wickets_lost=2,
    )

    assert start == 0
    assert after_ten_overs is not None and after_ten_overs > start
    assert after_wicket is not None and after_wicket > after_ten_overs


def test_dls_standard_resource_curve_matches_icc_example() -> None:
    assert cricket_overs_to_balls("28.0") == 168
    assert round(dls_resource_percentage(168, 1), 1) == 68.8
    assert dls_par_score(
        revised_target_runs=209,
        allotted_overs="38.0",
        legal_balls=182,
        wickets_lost=6,
        effective_resource_percentage=Decimal("83.2"),
    ) == 159


def test_cricket_overs_rejects_non_ball_decimal() -> None:
    try:
        cricket_overs_to_balls("19.46")
    except ValueError as error:
        assert "cricket notation" in str(error)
    else:
        raise AssertionError("Expected invalid cricket overs notation to be rejected")


def test_live_score_state_defaults_to_no_undone_event() -> None:
    state = LiveScoreStateOut(match_id=1, status="live")

    assert state.undone_event is None


def _wicket_ball(**overrides: object) -> LiveBallEventIn:
    values: dict[str, object] = {
        "innings": 1,
        "over_number": 0,
        "ball_number": 1,
        "batting_team_id": 1,
        "bowling_team_id": 2,
        "striker_player_id": 10,
        "non_striker_player_id": 11,
        "bowler_player_id": 20,
        "runs_batter": 0,
        "runs_extras": 0,
        "extras_type": None,
        "is_legal_delivery": True,
        "completed_runs": 0,
        "wicket_type": "run_out",
        "wicket_player_id": 10,
        "fielder_player_id": 21,
        "wicket_end": "striker",
    }
    values.update(overrides)
    return LiveBallEventIn(**values)


def test_wide_can_include_multiple_extras_and_run_out() -> None:
    body = _wicket_ball(
        extras_type="wide",
        runs_extras=3,
        completed_runs=2,
        is_legal_delivery=False,
    )

    _validate_live_ball_event(body)


def test_wicket_ball_does_not_require_a_replacement_batter() -> None:
    body = _wicket_ball(replacement_player_id=None)

    _validate_live_ball_event(body)
    assert body.replacement_player_id is None


def test_no_ball_can_include_batter_run_and_run_out() -> None:
    body = _wicket_ball(
        extras_type="no_ball",
        runs_batter=1,
        runs_extras=1,
        completed_runs=1,
        is_legal_delivery=False,
    )

    _validate_live_ball_event(body)


def test_no_ball_can_include_byes_and_run_out() -> None:
    body = _wicket_ball(
        extras_type="no_ball_bye",
        runs_extras=3,
        completed_runs=2,
        is_legal_delivery=False,
    )

    _validate_live_ball_event(body)


def test_live_ball_label_keeps_wicket_and_wide_visible() -> None:
    event = SimpleNamespace(
        is_dead_ball=False,
        wicket_type="run_out",
        extras_type="wide",
        runs_batter=0,
        runs_extras=3,
    )

    assert _live_ball_label(event) == "W+3wd"


def test_final_scorecard_dismissal_prefers_scorer_ball_commentary() -> None:
    event = SimpleNamespace(
        notes="Caught at deep midwicket by T. Ncube.\nOver note: Excellent over",
        dismissal_text="Caught · fielder: T. Ncube",
        wicket_type="caught",
        bowler_player_id=20,
        fielder_player_id=21,
    )

    dismissal = _dismissal_text_for_live_event(
        event,
        {20: "P. Moyo", 21: "T. Ncube"},
    )

    assert dismissal == "Caught at deep midwicket by T. Ncube."


def test_final_scorecard_dismissal_ignores_over_note_without_ball_commentary() -> None:
    event = SimpleNamespace(
        notes="Over note: Excellent over",
        dismissal_text="Caught · fielder: T. Ncube",
        wicket_type="caught",
        bowler_player_id=20,
        fielder_player_id=21,
    )

    dismissal = _dismissal_text_for_live_event(
        event,
        {20: "P. Moyo", 21: "T. Ncube"},
    )

    assert dismissal == "Caught · fielder: T. Ncube"
