from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1 import admin_routes
from app.api.v1.admin_routes import (
    _dismissal_text_for_live_event,
    _live_ball_label,
    _assert_live_players_not_dismissed,
    _validate_live_ball_event,
)
from app.models.match import Match
from app.schemas.matches import (
    LiveBallEventIn,
    LiveMatchConditionsIn,
    LiveScoreCompleteIn,
    LiveScoreStartIn,
    LiveScoreStateOut,
    MatchDetailOut,
    MatchLiveSetupIn,
    MatchSquadPlayerIn,
)
from app.services.dls import (
    cricket_overs_to_balls,
    dls_g50_for_category,
    dls_par_score,
    dls_resource_percentage,
    dls_revised_target,
    revised_resource_percentage,
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
    assert "dls_team1_resource_percentage" in Match.__table__.columns
    assert "dls_team2_resource_percentage" in Match.__table__.columns
    assert "scorecard_finalized_at" in Match.__table__.columns


def test_live_conditions_preserve_revised_overs_and_innings() -> None:
    body = LiveMatchConditionsIn(match_overs="35.0", innings=2)

    assert body.match_overs == Decimal("35.0")
    assert body.innings == 2
    assert body.clear_dls is False


def test_live_conditions_accept_blank_or_zero_to_clear_dls() -> None:
    blank = LiveMatchConditionsIn(match_overs=None, innings=2, clear_dls=True)
    zero = LiveMatchConditionsIn(match_overs="0", innings=2)

    assert blank.match_overs is None
    assert blank.clear_dls is True
    assert zero.match_overs == Decimal("0")


def test_clear_live_conditions_resets_dls_and_preserves_match_length(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    match = SimpleNamespace(
        id=1,
        match_overs=Decimal("35.0"),
        dls_team1_resource_percentage=Decimal("89.300"),
        dls_team2_resource_percentage=Decimal("83.200"),
        revised_target_runs=209,
    )
    commits: list[bool] = []
    audit_actions: list[str] = []

    class _Db:
        def get(self, _model: object, _match_id: int) -> SimpleNamespace:
            return match

        def commit(self) -> None:
            commits.append(True)

        def refresh(self, _match: object) -> None:
            return None

    monkeypatch.setattr(
        admin_routes,
        "_assert_can_edit_score_match",
        lambda *_args: None,
    )
    monkeypatch.setattr(
        admin_routes,
        "write_audit",
        lambda _db, **kwargs: audit_actions.append(str(kwargs["action"])),
    )
    monkeypatch.setattr(
        admin_routes,
        "_live_score_state",
        lambda _db, _match, *_args: LiveScoreStateOut(
            match_id=1,
            status="live",
            match_overs=match.match_overs,
        ),
    )

    state = admin_routes.admin_save_live_match_conditions(
        match_id=1,
        body=LiveMatchConditionsIn(match_overs=0, innings=2),
        db=_Db(),  # type: ignore[arg-type]
        actor=SimpleNamespace(id=7),  # type: ignore[arg-type]
    )

    assert match.match_overs == Decimal("35.0")
    assert match.dls_team1_resource_percentage is None
    assert match.dls_team2_resource_percentage is None
    assert match.revised_target_runs is None
    assert state.revised_target_runs is None
    assert audit_actions == ["clear_live_match_conditions"]
    assert len(commits) == 2


def test_match_squad_accepts_concussion_substitute() -> None:
    player = MatchSquadPlayerIn(
        player_id=12,
        role="concussion_substitute",
    )

    assert player.role == "concussion_substitute"


def test_completed_scorecard_locks_120_minutes_after_finalization() -> None:
    finalized_at = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    match = SimpleNamespace(
        id=12,
        status="completed",
        scorecard_finalized_at=finalized_at,
    )
    actor = SimpleNamespace(id=8, role="scorer")

    class _Db:
        def scalar(self, _statement: object) -> None:
            return None

    before_lock = admin_routes._scorecard_access(
        _Db(),  # type: ignore[arg-type]
        match,  # type: ignore[arg-type]
        actor,  # type: ignore[arg-type]
        now=finalized_at + timedelta(minutes=119),
    )
    after_lock = admin_routes._scorecard_access(
        _Db(),  # type: ignore[arg-type]
        match,  # type: ignore[arg-type]
        actor,  # type: ignore[arg-type]
        now=finalized_at + timedelta(minutes=120),
    )

    assert before_lock["scorecard_locked"] is False
    assert before_lock["can_edit_scorecard"] is True
    assert after_lock["scorecard_locked"] is True
    assert after_lock["can_edit_scorecard"] is False


def test_super_admin_approval_reopens_locked_scorecard_temporarily() -> None:
    finalized_at = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    now = finalized_at + timedelta(hours=3)
    match = SimpleNamespace(
        id=12,
        status="completed",
        scorecard_finalized_at=finalized_at,
    )
    actor = SimpleNamespace(id=8, role="scorer")
    request = SimpleNamespace(
        status="approved",
        access_until=now + timedelta(minutes=30),
    )

    class _Db:
        def scalar(self, _statement: object) -> SimpleNamespace:
            return request

    access = admin_routes._scorecard_access(
        _Db(),  # type: ignore[arg-type]
        match,  # type: ignore[arg-type]
        actor,  # type: ignore[arg-type]
        now=now,
    )

    assert access["scorecard_locked"] is True
    assert access["can_edit_scorecard"] is True
    assert access["edit_request_status"] == "approved"


def test_start_does_not_reopen_completed_scorecard(monkeypatch: pytest.MonkeyPatch) -> None:
    match = SimpleNamespace(
        id=12,
        status="completed",
        home_team_id=1,
        away_team_id=2,
    )
    actor = SimpleNamespace(id=8, role="scorer")

    class _Db:
        def get(self, _model: object, _match_id: int) -> SimpleNamespace:
            return match

        def commit(self) -> None:
            return None

        def refresh(self, _match: object) -> None:
            return None

    monkeypatch.setattr(
        admin_routes,
        "_assert_can_edit_score_match",
        lambda *_args: None,
    )
    monkeypatch.setattr(admin_routes, "_assert_live_team_ids", lambda *_args: None)
    monkeypatch.setattr(
        admin_routes,
        "_live_score_state",
        lambda _db, current_match, *_args: current_match.status,
    )

    status_after_start = admin_routes.admin_start_live_score(
        match_id=12,
        body=LiveScoreStartIn(batting_team_id=1, bowling_team_id=2),
        db=_Db(),  # type: ignore[arg-type]
        actor=actor,  # type: ignore[arg-type]
    )

    assert status_after_start == "completed"
    assert match.status == "completed"


def test_dls_revised_target_matches_icc_standard_examples() -> None:
    assert dls_revised_target(
        first_innings_runs=180,
        team1_resource_percentage=87.5,
        team2_resource_percentage=89.3,
        g50=245,
    ) == 185
    assert dls_revised_target(
        first_innings_runs=212,
        team1_resource_percentage=95.0,
        team2_resource_percentage=82.7,
        g50=245,
    ) == 185
    assert dls_revised_target(
        first_innings_runs=250,
        team1_resource_percentage=100.0,
        team2_resource_percentage=86.8,
        g50=245,
    ) == 218
    assert dls_revised_target(
        first_innings_runs=250,
        team1_resource_percentage=100.0,
        team2_resource_percentage=83.2,
        g50=245,
    ) == 209


def test_dls_g50_uses_published_category_values() -> None:
    assert dls_g50_for_category("mens") == 245
    assert dls_g50_for_category("women") == 200
    assert dls_g50_for_category("youth") == 200


def test_dls_resource_revision_accumulates_multiple_interruptions() -> None:
    first_revision = revised_resource_percentage(
        effective_resource_percentage=None,
        previous_allotted_balls=300,
        revised_allotted_balls=240,
        legal_balls=60,
        wickets_lost=0,
    )
    second_revision = revised_resource_percentage(
        effective_resource_percentage=first_revision,
        previous_allotted_balls=240,
        revised_allotted_balls=228,
        legal_balls=150,
        wickets_lost=5,
    )

    assert 0 < second_revision < first_revision < 100


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
    assert dls_resource_percentage(300, 0) == 100.0
    assert dls_resource_percentage(240, 0) == 89.3
    assert dls_resource_percentage(168, 1) == 68.8
    assert dls_par_score(
        revised_target_runs=209,
        allotted_overs="38.0",
        legal_balls=182,
        wickets_lost=6,
        effective_resource_percentage=Decimal("83.2"),
        first_innings_runs=250,
        team1_resource_percentage=Decimal("100.0"),
        g50=245,
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


def test_live_ball_rejects_already_dismissed_replacement_batter() -> None:
    body = _wicket_ball(replacement_player_id=12)

    with pytest.raises(HTTPException) as error:
        _assert_live_players_not_dismissed(body, {12})

    assert error.value.status_code == 400
    assert "Replacement batter has already been dismissed" in error.value.detail["message"]


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
