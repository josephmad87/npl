from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.admin_routes import _season_standing_team_ids
from app.db.base import Base
from app.models.league import League, Season, SeasonTeam
from app.models.match import Match, MatchPlayerStat, MatchResult
from app.models.player import Player
from app.models.team import Team


def test_t20_blast_standings_apply_all_playing_condition_points() -> None:
    """Knockout seeding must use the same T20 Blast points as public standings."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tables = [
        League.__table__,
        Season.__table__,
        SeasonTeam.__table__,
        Team.__table__,
        Player.__table__,
        Match.__table__,
        MatchResult.__table__,
        MatchPlayerStat.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)

    try:
        with sessions() as db:
            league = League(name="NPL T20 Blast", slug="npl-t20-blast", category="mens")
            db.add(league)
            db.flush()
            season = Season(league_id=league.id, name="Test T20 Blast", slug="test-t20-blast")
            home = Team(name="Home Club", slug="home-club", category="mens")
            away = Team(name="Away Club", slug="away-club", category="mens")
            db.add_all([season, home, away])
            db.flush()
            db.add_all([
                SeasonTeam(season_id=season.id, team_id=home.id),
                SeasonTeam(season_id=season.id, team_id=away.id),
            ])
            home_batter = Player(full_name="Home Batter", slug="home-batter", team_id=home.id, category="mens")
            away_batter = Player(full_name="Away Batter", slug="away-batter", team_id=away.id, category="mens")
            db.add_all([home_batter, away_batter])
            db.flush()

            def record_match(
                *,
                home_runs: int,
                away_runs: int,
                outcome: str,
                winner_id: int | None,
                batting_first_id: int | None,
            ) -> None:
                match = Match(
                    season_id=season.id,
                    category="mens",
                    home_team_id=home.id,
                    away_team_id=away.id,
                    status="completed",
                    is_published=True,
                    match_overs=20,
                )
                db.add(match)
                db.flush()
                db.add_all([
                    MatchPlayerStat(
                        match_id=match.id,
                        player_id=home_batter.id,
                        team_id=home.id,
                        batting_order=1,
                        runs=home_runs,
                    ),
                    MatchPlayerStat(
                        match_id=match.id,
                        player_id=away_batter.id,
                        team_id=away.id,
                        batting_order=1,
                        runs=away_runs,
                    ),
                    MatchResult(
                        match_id=match.id,
                        outcome=outcome,
                        winning_team_id=winner_id,
                        batting_first_team_id=batting_first_id,
                    ),
                ])

            # Away win chasing 200: 2 (win) + 1 (batting 200) + 1 (chase target 200).
            record_match(
                home_runs=199,
                away_runs=200,
                outcome="win",
                winner_id=away.id,
                batting_first_id=home.id,
            )
            # A tie gives each side 1 point; both sides still receive their batting bonus.
            record_match(
                home_runs=200,
                away_runs=200,
                outcome="tie",
                winner_id=None,
                batting_first_id=home.id,
            )
            # No result also earns 1 point, and the 200-run batting bonus remains valid.
            record_match(
                home_runs=200,
                away_runs=50,
                outcome="no_result",
                winner_id=None,
                batting_first_id=home.id,
            )
            db.commit()

            # Home: tie 1 + batting bonus 1 + no-result 1 + batting bonus 1 = 4.
            # Away: win 2 + batting bonus 1 + chase bonus 1 + tie 1 + batting bonus 1 + no-result 1 = 7.
            assert _season_standing_team_ids(db, season.id) == [away.id, home.id]
    finally:
        engine.dispose()
