from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.admin_routes import _season_standing_team_ids, _sync_playoff_fixture_teams
from app.db.base import Base
from app.models.league import League, Season, SeasonTeam
from app.models.match import (
    DisciplineCase, DisciplineSanction, Match, MatchBallEvent, MatchDaySquadPlayer,
    MatchPlayerStat, MatchResult, MatchScoringSession,
)
from app.models.player import Player
from app.models.team import Team
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[
        League.__table__, Season.__table__, SeasonTeam.__table__, Team.__table__, Player.__table__,
        User.__table__, Match.__table__, MatchResult.__table__, MatchPlayerStat.__table__,
        MatchBallEvent.__table__, MatchDaySquadPlayer.__table__, MatchScoringSession.__table__,
        DisciplineCase.__table__, DisciplineSanction.__table__,
    ])
    try:
        with sessionmaker(bind=engine, expire_on_commit=False)() as session:
            yield session
    finally:
        engine.dispose()


def _season_with_teams(db):
    league = League(name="NPL T20 Blast", slug="npl-t20-blast", category="mens")
    db.add(league)
    db.flush()
    season = Season(league_id=league.id, name="T20 Blast 2026", slug="t20-blast-2026")
    teams = [Team(name=f"Club {i}", slug=f"club-{i}", category="mens") for i in range(4)]
    db.add_all([season, *teams])
    db.flush()
    db.add_all(SeasonTeam(season_id=season.id, team_id=team.id) for team in teams)
    players = [Player(full_name=f"Player {i}", slug=f"player-{i}", team_id=team.id, category="mens")
               for i, team in enumerate(teams)]
    db.add_all(players)
    db.flush()
    return season, teams, players


def _record_result(db, season, home, away, home_player, away_player, *, home_runs, away_runs, winner, stage=None):
    match = Match(
        season_id=season.id, category="mens", home_team_id=home.id, away_team_id=away.id,
        status="completed", fixture_stage=stage, match_overs=10,
    )
    db.add(match)
    db.flush()
    db.add_all([
        MatchPlayerStat(match_id=match.id, team_id=home.id, player_id=home_player.id,
                        batting_order=1, runs=home_runs, balls_faced=60),
        MatchPlayerStat(match_id=match.id, team_id=away.id, player_id=away_player.id,
                        batting_order=1, runs=away_runs, balls_faced=60),
        MatchResult(match_id=match.id, outcome="win", winning_team_id=winner.id,
                    home_allotted_overs=Decimal("10.0"), away_allotted_overs=Decimal("10.0")),
    ])
    db.flush()
    return match


def test_playoff_seeding_uses_public_nrr_and_discipline_adjustments(db) -> None:
    season, teams, players = _season_with_teams(db)
    first = _record_result(db, season, teams[0], teams[2], players[0], players[2],
                           home_runs=100, away_runs=99, winner=teams[0])
    _record_result(db, season, teams[1], teams[3], players[1], players[3],
                   home_runs=150, away_runs=50, winner=teams[1])
    # Both winners have two points; Club 1's larger NRR outranks lower-ID Club 0.
    assert _season_standing_team_ids(db, season.id)[:2] == [teams[1].id, teams[0].id]

    _record_result(db, season, teams[0], teams[1], players[0], players[1],
                   home_runs=180, away_runs=10, winner=teams[0], stage="qualifier_1")
    assert _season_standing_team_ids(db, season.id)[:2] == [teams[1].id, teams[0].id]

    case = DisciplineCase(match_id=first.id, category="competition", summary="Points deduction", status="decided")
    db.add(case)
    db.flush()
    db.add(DisciplineSanction(case_id=case.id, sanction_type="points_deduction",
                              team_id=teams[1].id, points_delta=-1, status="active"))
    assert _season_standing_team_ids(db, season.id)[:2] == [teams[0].id, teams[1].id]


def test_no_result_does_not_earn_t20_batting_bonus(db) -> None:
    season, teams, players = _season_with_teams(db)
    match = Match(season_id=season.id, category="mens", home_team_id=teams[0].id,
                  away_team_id=teams[1].id, status="completed")
    db.add(match)
    db.flush()
    db.add_all([
        MatchResult(match_id=match.id, outcome="no_result"),
        MatchPlayerStat(match_id=match.id, team_id=teams[1].id, player_id=players[1].id,
                        batting_order=1, runs=200, balls_faced=60),
    ])
    # Both sides receive one point and zero NRR, so lower team ID wins the tie.
    assert _season_standing_team_ids(db, season.id)[:2] == [teams[0].id, teams[1].id]


def test_playoff_seeding_uses_fewer_losses_and_only_public_results(db) -> None:
    season, teams, _ = _season_with_teams(db)
    loss = Match(season_id=season.id, category="mens", home_team_id=teams[0].id,
                 away_team_id=teams[2].id, status="completed", is_published=True)
    unpublished = Match(season_id=season.id, category="mens", home_team_id=teams[0].id,
                        away_team_id=teams[1].id, status="completed", is_published=False)
    no_result = Match(season_id=season.id, category="mens", home_team_id=teams[0].id,
                      away_team_id=teams[1].id, status="completed", is_published=True)
    db.add_all([loss, unpublished, no_result])
    db.flush()
    db.add_all([
        MatchResult(match_id=loss.id, outcome="win", winning_team_id=teams[2].id),
        MatchResult(match_id=unpublished.id, outcome="win", winning_team_id=teams[0].id),
    ])
    # The completed no-result fixture has no result row: both sides still earn
    # one point. Club 1 beats lower-ID Club 0 on fewer losses; the unpublished
    # win does not change the public table or playoff seeds.
    order = _season_standing_team_ids(db, season.id)
    assert order.index(teams[1].id) < order.index(teams[0].id)


def test_playoff_sync_only_reseeds_scheduled_unscored_fixtures(db) -> None:
    season, teams, players = _season_with_teams(db)
    user = User(email="scorer@example.com", hashed_password="test", role="scorer")
    db.add(user)
    regular = _record_result(db, season, teams[0], teams[1], players[0], players[1],
                             home_runs=100, away_runs=90, winner=teams[0])
    db.flush()

    def bracket_match(*, status="scheduled", stage="qualifier_1"):
        row = Match(
            season_id=season.id, category="mens", home_team_id=teams[0].id, away_team_id=teams[1].id,
            status=status, fixture_stage=stage, home_team_source="standing:1", away_team_source="standing:2",
        )
        db.add(row)
        db.flush()
        return row

    untouched = bracket_match()
    live = bracket_match(status="live")
    completed = bracket_match(status="completed")
    db.add(MatchResult(match_id=completed.id, outcome="win", winning_team_id=teams[0].id))
    with_result = bracket_match()
    db.add(MatchResult(match_id=with_result.id, outcome="win", winning_team_id=teams[0].id))
    with_stats = bracket_match()
    db.add(MatchPlayerStat(match_id=with_stats.id, player_id=players[0].id, team_id=teams[0].id,
                           batting_order=1, runs=1, balls_faced=1))
    with_delivery = bracket_match()
    db.add(MatchBallEvent(match_id=with_delivery.id, innings=1, over_number=0, ball_number=1,
                          batting_team_id=teams[0].id, bowling_team_id=teams[1].id,
                          striker_player_id=players[0].id, bowler_player_id=players[1].id, sequence_number=1))
    with_squad = bracket_match()
    db.add(MatchDaySquadPlayer(match_id=with_squad.id, team_id=teams[0].id,
                               player_id=players[0].id, role="playing"))
    with_session = bracket_match()
    db.add(MatchScoringSession(match_id=with_session.id, owner_user_id=user.id,
                               session_token="test-session", device_id="device-1",
                               expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
    with_scoring_version = bracket_match()
    with_scoring_version.scoring_version = 1
    next_qualifier = Match(
        season_id=season.id, category="mens", home_team_id=teams[0].id, away_team_id=teams[2].id,
        status="scheduled", fixture_stage="qualifier_2", home_team_source=f"match:{completed.id}:loser",
    )
    db.add(next_qualifier)
    db.flush()

    regular.result.winning_team_id = teams[1].id
    _sync_playoff_fixture_teams(db, season.id)
    db.flush()

    assert (untouched.home_team_id, untouched.away_team_id) == (teams[1].id, teams[0].id)
    for protected in (live, completed, with_result, with_stats, with_delivery, with_squad,
                      with_session, with_scoring_version):
        assert (protected.home_team_id, protected.away_team_id) == (teams[0].id, teams[1].id)
    # The completed Qualifier 1 keeps its participants, so its loser remains Club 1.
    assert next_qualifier.home_team_id == teams[1].id
