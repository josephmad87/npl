from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - register the complete metadata graph
from app.api.v1 import admin_routes
from app.db.base import Base
from app.models.match import Match, MatchBallEvent, MatchPlayerStat
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.schemas.matches import LiveBallEventIn, LiveScoreCompleteIn, ScoringSessionAcquireIn


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_type: JSONB, _compiler: object, **_kwargs: object) -> str:
    return "JSON"


@contextmanager
def scoring_database() -> Iterator[tuple[Session, Match, User, list[Player], list[Player]]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    table_names = [
        "users",
        "leagues",
        "seasons",
        "teams",
        "players",
        "matches",
        "match_results",
        "match_player_stats",
        "match_scorer_assignments",
        "match_scoring_sessions",
        "match_scorecard_edit_requests",
        "match_ball_events",
        "match_squad_players",
        "audit_logs",
    ]
    tables = [Base.metadata.tables[name] for name in table_names]
    Base.metadata.create_all(engine, tables=tables)
    with Session(engine, expire_on_commit=False) as db:
        home = Team(name="Home Club", slug="home-club", category="mens")
        away = Team(name="Away Club", slug="away-club", category="mens")
        actor = User(
            email="admin@example.test",
            hashed_password="unused",
            full_name="Test Administrator",
            role="super_admin",
        )
        other_actor = User(
            email="other@example.test",
            hashed_password="unused",
            full_name="Other Scorer",
            role="super_admin",
        )
        db.add_all([home, away, actor, other_actor])
        db.flush()
        home_players = [
            Player(
                full_name=f"Home Player {number}",
                slug=f"home-player-{number}",
                team_id=home.id,
                category="mens",
            )
            for number in range(1, 6)
        ]
        away_players = [
            Player(
                full_name=f"Away Player {number}",
                slug=f"away-player-{number}",
                team_id=away.id,
                category="mens",
            )
            for number in range(1, 5)
        ]
        db.add_all([*home_players, *away_players])
        db.flush()
        match = Match(
            category="mens",
            home_team_id=home.id,
            away_team_id=away.id,
            match_date=date(2026, 9, 2),
            match_overs=1,
            status="scheduled",
        )
        db.add(match)
        db.commit()
        yield db, match, actor, home_players, away_players
    engine.dispose()


def event_input(
    *,
    client_id: str,
    innings: int,
    batting_team_id: int,
    bowling_team_id: int,
    striker_id: int,
    non_striker_id: int,
    bowler_id: int,
    **changes: object,
) -> LiveBallEventIn:
    values: dict[str, object] = {
        "client_event_id": client_id,
        "innings": innings,
        "over_number": 0,
        "ball_number": 1,
        "batting_team_id": batting_team_id,
        "bowling_team_id": bowling_team_id,
        "striker_player_id": striker_id,
        "non_striker_player_id": non_striker_id,
        "bowler_player_id": bowler_id,
        "runs_batter": 0,
        "runs_extras": 0,
        "is_legal_delivery": True,
        "completed_runs": 0,
    }
    values.update(changes)
    return LiveBallEventIn(**values)


def acquire(db: Session, match: Match, actor: User, device_id: str = "device-primary") -> str:
    session = admin_routes.admin_acquire_scoring_session(
        match_id=match.id,
        body=ScoringSessionAcquireIn(
            device_id=device_id,
            device_label="Workflow test browser",
        ),
        db=db,
        actor=actor,
    )
    assert session.session_token
    return session.session_token


def record(
    db: Session,
    match: Match,
    actor: User,
    token: str,
    body: LiveBallEventIn,
) -> MatchBallEvent:
    saved = admin_routes.admin_create_live_ball(
        match_id=match.id,
        body=body,
        score_version=match.scoring_version,
        scoring_session_token=token,
        db=db,
        actor=actor,
    )
    row = db.get(MatchBallEvent, saved.id)
    assert row is not None
    return row


def test_scoring_version_and_session_ownership_prevent_conflicting_writes() -> None:
    with scoring_database() as (db, match, actor, home_players, away_players):
        other_actor = db.scalar(select(User).where(User.email == "other@example.test"))
        assert other_actor is not None
        token = acquire(db, match, actor)

        with pytest.raises(HTTPException) as missing_version:
            admin_routes._assert_score_version(match, None)
        assert missing_version.value.status_code == 428

        with pytest.raises(HTTPException) as owned:
            admin_routes.admin_acquire_scoring_session(
                match_id=match.id,
                body=ScoringSessionAcquireIn(
                    device_id="device-secondary",
                    device_label="Second browser",
                ),
                db=db,
                actor=other_actor,
            )
        assert owned.value.status_code == 409

        replacement = admin_routes.admin_acquire_scoring_session(
            match_id=match.id,
            body=ScoringSessionAcquireIn(
                device_id="device-secondary",
                device_label="Second browser",
                force_takeover=True,
                takeover_reason="Primary scorer lost connectivity",
            ),
            db=db,
            actor=other_actor,
        )
        assert replacement.session_token

        delivery = event_input(
            client_id="ownership-ball-0001",
            innings=1,
            batting_team_id=match.home_team_id,
            bowling_team_id=match.away_team_id,
            striker_id=home_players[0].id,
            non_striker_id=home_players[1].id,
            bowler_id=away_players[0].id,
        )
        with pytest.raises(HTTPException) as old_owner:
            admin_routes.admin_create_live_ball(
                match_id=match.id,
                body=delivery,
                score_version=0,
                scoring_session_token=token,
                db=db,
                actor=actor,
            )
        assert old_owner.value.status_code == 409

        saved = admin_routes.admin_create_live_ball(
            match_id=match.id,
            body=delivery,
            score_version=0,
            scoring_session_token=replacement.session_token,
            db=db,
            actor=other_actor,
        )
        assert saved.score_version == 1

        # A timeout retry is idempotent even though its original version is stale.
        duplicate = admin_routes.admin_create_live_ball(
            match_id=match.id,
            body=delivery,
            score_version=0,
            scoring_session_token=replacement.session_token,
            db=db,
            actor=other_actor,
        )
        assert duplicate.id == saved.id
        assert duplicate.score_version == 1

        with pytest.raises(HTTPException) as stale:
            admin_routes.admin_create_live_ball(
                match_id=match.id,
                body=delivery.model_copy(update={"client_event_id": "ownership-ball-0002"}),
                score_version=0,
                scoring_session_token=replacement.session_token,
                db=db,
                actor=other_actor,
            )
        assert stale.value.status_code == 409


def test_full_scoring_workflow_reconciles_scorecard_and_player_statistics() -> None:
    with scoring_database() as (db, match, actor, home_players, away_players):
        token = acquire(db, match, actor)
        home = match.home_team_id
        away = match.away_team_id
        h1, h2, h3, h4, _h5 = home_players
        a1, a2, a3, _a4 = away_players

        deliveries = [
            event_input(
                client_id="workflow-ball-0001",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                runs_batter=4,
                completed_runs=4,
            ),
            event_input(
                client_id="workflow-ball-0002",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                runs_extras=3,
                extras_type="wide",
                is_legal_delivery=False,
                completed_runs=2,
            ),
            event_input(
                client_id="workflow-ball-0003",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                runs_batter=2,
                runs_extras=1,
                extras_type="no_ball",
                is_legal_delivery=False,
                completed_runs=2,
            ),
            event_input(
                client_id="workflow-ball-0004",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                runs_batter=2,
                completed_runs=3,
                short_runs=1,
            ),
            event_input(
                client_id="workflow-ball-0005",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                runs_extras=2,
                extras_type="bye",
                completed_runs=2,
            ),
            event_input(
                client_id="workflow-ball-0006",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h1.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                wicket_type="caught",
                wicket_player_id=h1.id,
                fielder_player_id=a2.id,
                replacement_player_id=h3.id,
                dismissal_text=f"c {a2.full_name} b {a1.full_name}",
            ),
            event_input(
                client_id="workflow-ball-0007",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h3.id,
                non_striker_id=h2.id,
                bowler_id=a1.id,
                is_dead_ball=True,
                is_legal_delivery=False,
                wicket_type="retired_hurt",
                wicket_player_id=h2.id,
                replacement_player_id=h4.id,
                dismissal_text="retired hurt",
            ),
            event_input(
                client_id="workflow-ball-0008",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h3.id,
                non_striker_id=h4.id,
                bowler_id=a1.id,
                runs_extras=1,
                extras_type="leg_bye",
                completed_runs=1,
                leg_bye_attempted=True,
            ),
            event_input(
                client_id="workflow-ball-0009",
                innings=1,
                batting_team_id=home,
                bowling_team_id=away,
                striker_id=h4.id,
                non_striker_id=h3.id,
                bowler_id=a1.id,
            ),
        ]
        recorded = [record(db, match, actor, token, body) for body in deliveries]

        first_state = admin_routes._live_score_state(db, match, actor)
        first = first_state.summaries[0]
        assert first.runs == 15
        assert first.wickets == 1
        assert first.legal_balls == 6
        assert first.overs_label == "1.0"

        corrected = event_input(
            client_id="workflow-ball-0009",
            innings=1,
            batting_team_id=home,
            bowling_team_id=away,
            striker_id=h4.id,
            non_striker_id=h3.id,
            bowler_id=a1.id,
            runs_batter=1,
            completed_runs=1,
        )
        corrected_state = admin_routes.admin_update_live_ball(
            match_id=match.id,
            event_id=recorded[-1].id,
            body=corrected,
            score_version=match.scoring_version,
            scoring_session_token=token,
            db=db,
            actor=actor,
        )
        assert corrected_state.summaries[0].runs == 16
        assert corrected_state.scorecard_reconciled_version == corrected_state.scoring_version

        for number, runs in enumerate((6, 6, 5), start=1):
            record(
                db,
                match,
                actor,
                token,
                event_input(
                    client_id=f"workflow-chase-000{number}",
                    innings=2,
                    batting_team_id=away,
                    bowling_team_id=home,
                    striker_id=a3.id,
                    non_striker_id=a2.id,
                    bowler_id=h3.id,
                    runs_batter=runs,
                    completed_runs=runs,
                ),
            )

        chase_state = admin_routes._live_score_state(db, match, actor)
        assert chase_state.current_innings == 2
        assert chase_state.summaries[1].batting_team_id == away
        assert chase_state.summaries[1].bowling_team_id == home
        assert chase_state.summaries[1].runs == 17
        assert chase_state.summaries[0].runs + 1 == chase_state.summaries[1].runs

        final_state = admin_routes.admin_complete_live_score(
            match_id=match.id,
            body=LiveScoreCompleteIn(status="completed", match_overs=1),
            score_version=match.scoring_version,
            scoring_session_token=token,
            db=db,
            actor=actor,
        )
        assert final_state.status == "completed"
        assert final_state.scorecard_reconciliation_status == "in_sync"
        assert final_state.scorecard_reconciled_version == final_state.scoring_version
        assert match.result is not None
        assert match.result.winning_team_id == away
        assert match.result.margin_text == "Won by 10 wickets"

        stats = {
            row.player_id: row
            for row in db.scalars(
                select(MatchPlayerStat).where(MatchPlayerStat.match_id == match.id),
            ).all()
        }
        assert stats[h1.id].runs == 8
        # Legal balls plus a No-ball faced count; the Wide does not.
        assert stats[h1.id].balls_faced == 5
        assert stats[h1.id].dismissal == f"c {a2.full_name} b {a1.full_name}"
        assert stats[h2.id].dismissal == "retired hurt"
        assert stats[a1.id].overs == 1
        # All Wide and No-ball runs are charged; byes and leg-byes are not.
        assert stats[a1.id].runs_conceded == 13
        assert stats[a1.id].wickets == 1
        assert recorded[3].short_runs == 1

        active_session = admin_routes.admin_current_scoring_session(
            match_id=match.id,
            db=db,
            actor=actor,
        )
        assert active_session is None

        # Simulate a damaged materialized scorecard. The ledger remains intact,
        # so the reconciliation endpoint must restore all derived rows.
        db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == match.id))
        match.scorecard_reconciled_version = match.scoring_version - 1
        match.scorecard_reconciliation_status = "out_of_sync"
        db.commit()
        recovery_token = acquire(db, match, actor, "device-recovery")
        recovered = admin_routes.admin_reconcile_live_scorecard(
            match_id=match.id,
            score_version=match.scoring_version,
            scoring_session_token=recovery_token,
            db=db,
            actor=actor,
        )
        assert recovered.scorecard_reconciliation_status == "in_sync"
        assert recovered.scorecard_reconciled_version == recovered.scoring_version
        assert db.scalar(
            select(MatchPlayerStat.id).where(MatchPlayerStat.match_id == match.id),
        ) is not None
