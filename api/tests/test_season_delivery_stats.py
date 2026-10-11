from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.public_routes import season_stats_details
from app.db.base import Base
from app.models.league import League, Season, SeasonPlayer, SeasonTeam
from app.models.match import Match, MatchBallEvent, MatchPlayerStat
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.services.season_delivery_stats import summarize_season_deliveries


def _event(sequence: int, **updates):
    values = {
        "match_id": 1, "innings": 1, "sequence_number": sequence,
        "batting_team_id": 1, "striker_player_id": 11, "non_striker_player_id": 12,
        "runs_batter": 0, "runs_extras": 0, "penalty_runs_batting": 0,
        "extras_type": None, "is_legal_delivery": True, "is_dead_ball": False,
        "boundary_runs": 0, "wicket_type": None,
    }
    values.update(updates)
    return SimpleNamespace(**values)


def test_delivery_counts_and_partnerships_use_recorded_events():
    events = [
        _event(1, runs_batter=1),
        _event(2, runs_batter=2),
        _event(3, runs_batter=3),
        _event(4),
        _event(5, runs_batter=4, runs_extras=1, extras_type="no_ball", is_legal_delivery=False),
        _event(6, runs_extras=1, extras_type="wide", is_legal_delivery=False),
    ]
    events += [_event(i, runs_batter=6) for i in range(7, 15)]
    events.append(_event(15, wicket_type="bowled"))
    events += [_event(i, striker_player_id=13, runs_batter=6) for i in range(16, 33)]
    events.append(_event(33, striker_player_id=13, wicket_type="caught"))
    result = summarize_season_deliveries(events)
    all_counts = result["tournament"]
    assert result["recorded_match_count"] == 1
    assert (all_counts["ones"], all_counts["twos"], all_counts["threes"]) == (1, 1, 1)
    assert all_counts["dots"] == 3
    assert all_counts["balls_faced"] == len(events) - 1  # wide is not faced
    assert all_counts["partnerships_50"] == 2
    assert all_counts["partnerships_100"] == 1
    assert result["players"][11]["partnerships_50"] == 1
    assert result["players"][12]["partnerships_50"] == 2
    assert result["players"][13]["partnerships_100"] == 1


def test_season_stats_profiles_include_borrowed_and_reserve_but_dropdown_excludes_outsider():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[
        League.__table__, Season.__table__, Team.__table__, Player.__table__,
        SeasonTeam.__table__, SeasonPlayer.__table__, Match.__table__,
        MatchPlayerStat.__table__, MatchBallEvent.__table__, User.__table__,
    ])
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with sessions() as db:
            league = League(name="Blast", slug="blast", category="mens")
            club = Team(name="Club", slug="club", category="mens")
            other = Team(name="Other", slug="other", category="mens")
            db.add_all([league, club, other])
            db.flush()
            season = Season(league_id=league.id, name="Blast 2026", slug="blast-2026")
            db.add(season)
            db.flush()
            borrowed = Player(full_name="Borrowed Batter", slug="borrowed-batter", team_id=other.id, category="mens")
            reserve = Player(full_name="Reserve Bowler", slug="reserve-bowler", team_id=club.id, category="mens", status="inactive")
            outsider = Player(full_name="Former Batter", slug="former-batter", team_id=other.id, category="mens")
            db.add_all([borrowed, reserve, outsider])
            db.flush()
            db.add_all([
                SeasonTeam(season_id=season.id, team_id=club.id),
                SeasonPlayer(season_id=season.id, player_id=borrowed.id, team_id=club.id, role="registered"),
                SeasonPlayer(season_id=season.id, player_id=reserve.id, team_id=club.id, role="standby"),
            ])
            match = Match(season_id=season.id, category="mens", home_team_id=club.id, away_team_id=other.id,
                          status="completed", is_published=True)
            db.add(match)
            db.flush()
            db.add_all([
                MatchPlayerStat(match_id=match.id, team_id=club.id, player_id=borrowed.id),
                MatchPlayerStat(match_id=match.id, team_id=other.id, player_id=outsider.id),
                MatchBallEvent(match_id=match.id, innings=1, over_number=0, ball_number=1,
                               batting_team_id=club.id, bowling_team_id=other.id,
                               striker_player_id=borrowed.id, non_striker_player_id=reserve.id,
                               bowler_player_id=outsider.id, runs_batter=1, sequence_number=1),
            ])
            db.commit()
            result = season_stats_details(season.id, db)
            assert {p["full_name"] for p in result["players"]} == {
                "Borrowed Batter", "Reserve Bowler", "Former Batter",
            }
            assert result["eligible_player_ids"] == sorted([borrowed.id, reserve.id])
            assert result["delivery_stats"]["tournament"]["ones"] == 1
            assert result["delivery_stats"]["players"][borrowed.id]["ones"] == 1
    finally:
        engine.dispose()
