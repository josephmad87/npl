from types import SimpleNamespace

from app.api.v1.admin_routes import _bowler_runs_for_live_event


def test_wide_additional_runs_stay_out_of_bowler_figures() -> None:
    wide = SimpleNamespace(extras_type="wide", runs_batter=0, runs_extras=4)

    assert _bowler_runs_for_live_event(wide) == 1


def test_single_wide_penalty_is_charged_to_bowler() -> None:
    wide = SimpleNamespace(extras_type="wide", runs_batter=0, runs_extras=1)

    assert _bowler_runs_for_live_event(wide) == 1
