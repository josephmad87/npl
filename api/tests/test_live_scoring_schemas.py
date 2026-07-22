from decimal import Decimal
from types import SimpleNamespace

from app.api.v1.admin_routes import (
    _dismissal_text_for_live_event,
    _live_ball_label,
    _validate_live_ball_event,
)
from app.schemas.matches import (
    LiveBallEventIn,
    LiveScoreCompleteIn,
    LiveScoreStateOut,
    MatchLiveSetupIn,
)


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
