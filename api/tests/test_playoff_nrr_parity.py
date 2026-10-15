from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.admin_routes import _season_standing_team_ids
from app.db.base import Base
from app.models.league import League, Season, SeasonTeam
from app.models.match import DisciplineCase, DisciplineSanction, Match, MatchPlayerStat, MatchResult
from app.models.player import Player
from app.models.team import Team


def test_playoff_seeding_uses_allotted_overs_for_all_out_and_honours_nrr_exclusion() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[
        League.__table__, Season.__table__, SeasonTeam.__table__, Team.__table__,
        Player.__table__, Match.__table__, MatchResult.__table__, MatchPlayerStat.__table__,
        DisciplineCase.__table__, DisciplineSanction.__table__,
    ])
    sessions = sessionmaker(bind=engine, expire_on_commit=False)

    try:
        with sessions() as db:
            league = League(name="NPL T20 Blast", slug="npl-t20-blast", category="mens")
            db.add(league)
            db.flush()
            season = Season(league_id=league.id, name="Test T20 Blast", slug="test-t20-blast")
            teams = [
                Team(name=f"Club {number}", slug=f"club-{number}", category="mens")
                for number in range(4)
            ]
            db.add_all([season, *teams])
            db.flush()
            db.add_all(SeasonTeam(season_id=season.id, team_id=team.id) for team in teams)

            def player(team: Team, number: int) -> Player:
                row = Player(
                    full_name=f"Club {team.id} Player {number}",
                    slug=f"club-{team.id}-player-{number}",
                    team_id=team.id,
                    category="mens",
                )
                db.add(row)
                db.flush()
                return row

            # Club 0 scores 100 in 20 overs. Club 2 makes 90 in five overs,
            # but loses all ten wickets, so its NRR innings uses all 20 overs.
            first = Match(
                season_id=season.id,
                category="mens",
                home_team_id=teams[0].id,
                away_team_id=teams[2].id,
                status="completed",
                fixture_stage=None,
                match_overs=Decimal("20"),
            )
            db.add(first)
            db.flush()
            first_result = MatchResult(
                match_id=first.id,
                outcome="win",
                winning_team_id=teams[0].id,
                home_allotted_overs=Decimal("20"),
                away_allotted_overs=Decimal("20"),
            )
            db.add(first_result)
            db.add(MatchPlayerStat(
                match_id=first.id,
                player_id=player(teams[0], 1).id,
                team_id=teams[0].id,
                batting_order=1,
                runs=100,
                balls_faced=120,
            ))
            for number in range(1, 11):
                db.add(MatchPlayerStat(
                    match_id=first.id,
                    player_id=player(teams[2], number).id,
                    team_id=teams[2].id,
                    batting_order=number,
                    runs=9,
                    balls_faced=3,
                    dismissal="b Bowler",
                ))

            # Club 1 wins by five runs at a lower NRR of +0.25.
            second = Match(
                season_id=season.id,
                category="mens",
                home_team_id=teams[1].id,
                away_team_id=teams[3].id,
                status="completed",
                fixture_stage=None,
                match_overs=Decimal("20"),
            )
            db.add(second)
            db.flush()
            db.add(MatchResult(
                match_id=second.id,
                outcome="win",
                winning_team_id=teams[1].id,
                home_allotted_overs=Decimal("20"),
                away_allotted_overs=Decimal("20"),
            ))
            db.add_all([
                MatchPlayerStat(
                    match_id=second.id,
                    player_id=player(teams[1], 1).id,
                    team_id=teams[1].id,
                    batting_order=1,
                    runs=100,
                    balls_faced=120,
                ),
                MatchPlayerStat(
                    match_id=second.id,
                    player_id=player(teams[3], 1).id,
                    team_id=teams[3].id,
                    batting_order=1,
                    runs=95,
                    balls_faced=120,
                ),
            ])
            db.flush()

            # Both winners have two points and one win. Club 0's NRR is +0.5
            # only if Club 2's all-out innings is charged the full 20 overs.
            assert _season_standing_team_ids(db, season.id)[:2] == [teams[0].id, teams[1].id]

            first_result.nrr_excluded = True
            db.flush()
            # Excluding the first result from NRR leaves its win points intact.
            assert _season_standing_team_ids(db, season.id)[:2] == [teams[1].id, teams[0].id]
    finally:
        engine.dispose()
