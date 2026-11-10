from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.db.base import Base
from app.models.league import League, Season, SeasonPlayer, SeasonTeam
from app.models.team import Team
from app.models.player import Player
from app.models.match import Match, MatchPlayerStat, MatchDaySquadPlayer
from app.services.published_squads import season_squad


def test_reconciliation_preserves_registrations_and_isolates_seasons():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[
            League.__table__,
            Season.__table__,
            Team.__table__,
            Player.__table__,
            SeasonTeam.__table__,
            SeasonPlayer.__table__,
            Match.__table__,
            MatchPlayerStat.__table__,
            MatchDaySquadPlayer.__table__,
        ],
    )
    with Session(engine) as db:
        league = League(name="Women", slug="women", category="women")
        a = Team(name="A", slug="a", category="women")
        b = Team(name="B", slug="b", category="women")
        db.add_all([league, a, b])
        db.flush()
        season = Season(league_id=league.id, name="2026", slug="2026")
        old = Season(league_id=league.id, name="2025", slug="2025")
        db.add_all([season, old])
        db.flush()
        players = [Player(full_name=f"Player {i}", slug=f"p-{i}", team_id=a.id, category="women") for i in range(5)]
        db.add_all(players)
        db.flush()
        match = Match(
            season_id=season.id,
            category="women",
            home_team_id=a.id,
            away_team_id=b.id,
            status="completed",
            is_published=True,
        )
        hidden = Match(
            season_id=season.id,
            category="women",
            home_team_id=a.id,
            away_team_id=b.id,
            status="completed",
            is_published=False,
        )
        db.add_all([match, hidden])
        db.flush()
        db.add_all(
            [
                MatchPlayerStat(match_id=match.id, player_id=players[0].id, team_id=a.id),
                MatchDaySquadPlayer(match_id=match.id, player_id=players[1].id, team_id=a.id, role="playing_xi"),
                MatchPlayerStat(match_id=hidden.id, player_id=players[2].id, team_id=a.id),
                MatchPlayerStat(match_id=match.id, player_id=players[3].id, team_id=b.id),
                MatchDaySquadPlayer(match_id=match.id, player_id=players[3].id, team_id=a.id, role="playing_xi"),
            ]
        )
        db.flush()
        result = season_squad(db, season.id, a.id)
        assert {p["id"] for p in result["players"]} == {players[0].id, players[1].id}
        assert all(p["season_roster_role"] == "recorded" for p in result["players"])
        assert any(f["code"] == "conflicting_team_evidence" for f in result["flags"])
        assert not season_squad(db, old.id, a.id)["players"]
        assert not db.scalars(select(SeasonPlayer)).all()
        db.add_all(
            [
                SeasonPlayer(season_id=season.id, team_id=a.id, player_id=players[0].id, role="registered"),
                SeasonPlayer(season_id=season.id, team_id=a.id, player_id=players[4].id, role="standby"),
            ]
        )
        db.flush()
        result = season_squad(db, season.id, a.id)
        assert result["source"] == "registrations"
        assert {p["season_roster_role"] for p in result["players"]} == {"registered", "standby"}
        assert any(f["code"] == "unregistered_match_player" for f in result["flags"])
