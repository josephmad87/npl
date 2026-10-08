import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.admin_routes import _assert_live_player, _validate_squad_player, admin_get_season_players, admin_save_season_players
from app.api.v1.public_routes import get_player, public_match_eligible_players, team_season_players
from app.db.base import Base
from app.models.audit import AuditLog
from app.models.league import League, Season, SeasonPlayer, SeasonTeam
from app.models.match import Match, MatchDaySquadPlayer, MatchPlayerStat
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.schemas.seasons import SeasonPlayerRosterIn


def test_season_roster_shows_registered_players_and_keeps_other_players() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[
        League.__table__, Season.__table__, Team.__table__, Player.__table__, SeasonTeam.__table__,
        SeasonPlayer.__table__, Match.__table__, MatchDaySquadPlayer.__table__, MatchPlayerStat.__table__,
        User.__table__, AuditLog.__table__,
    ])
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with sessions() as db:
            league = League(name="NPL T20 Blast", slug="npl-t20-blast", category="mens")
            team = Team(name="Club", slug="club", category="mens")
            other = Team(name="Other", slug="other", category="mens")
            user = User(email="admin@example.com", hashed_password="test", role="admin")
            db.add_all([league, team, other, user])
            db.flush()
            season = Season(league_id=league.id, name="NPL T20 Blast 2026", slug="2026")
            db.add(season)
            db.flush()
            db.add_all([
                SeasonTeam(season_id=season.id, team_id=team.id),
                SeasonTeam(season_id=season.id, team_id=other.id),
            ])
            players = [Player(full_name=f"Player {i}", slug=f"player-{i}", team_id=team.id, category="mens") for i in range(21)]
            outsider = Player(full_name="Outsider", slug="outsider", team_id=other.id, category="mens")
            players[0].status = "inactive"
            players[15].status = "inactive"
            outsider.status = "inactive"
            db.add_all([*players, outsider])
            db.commit()

            registered = [player.id for player in players[:15]]
            standby = [player.id for player in players[15:20]]
            body = SeasonPlayerRosterIn(registered_player_ids=registered, standby_player_ids=standby)
            saved = admin_save_season_players(season.id, team.id, body, db, user)
            assert len(saved.registered_player_ids) == 15
            assert len(saved.standby_player_ids) == 5
            assert db.get(Player, players[0].id).status == "active"
            assert db.get(Player, players[15].id).status == "inactive"
            assert admin_get_season_players(season.id, team.id, db, user).standby_player_ids == standby
            assert {player.id for player in team_season_players("club", season.id, db)} == set(registered)
            assert len(db.scalars(select(Player)).all()) == 22

            replacement = players[20].id
            updated = SeasonPlayerRosterIn(registered_player_ids=[*registered[:-1], replacement], standby_player_ids=standby)
            admin_save_season_players(season.id, team.id, updated, db, user)
            assert registered[-1] not in {player.id for player in team_season_players("club", season.id, db)}
            assert db.get(Player, registered[-1]) is not None

            with pytest.raises(HTTPException) as duplicate:
                admin_save_season_players(season.id, team.id, SeasonPlayerRosterIn(
                    registered_player_ids=[players[0].id], standby_player_ids=[players[0].id],
                ), db, user)
            assert duplicate.value.status_code == 400
            guest_roster = SeasonPlayerRosterIn(
                registered_player_ids=[*registered[:-1], outsider.id], standby_player_ids=standby,
            )
            admin_save_season_players(season.id, team.id, guest_roster, db, user)
            assert outsider.team_id == other.id
            assert outsider.status == "active"
            assert outsider.id in {player.id for player in team_season_players("club", season.id, db)}
            assert get_player("outsider", db).blast_2026_team_id == team.id
            match = Match(season_id=season.id, category="mens", home_team_id=team.id, away_team_id=other.id)
            db.add(match)
            db.commit()
            eligible = public_match_eligible_players(match.id, db)
            guest = next(player for player in eligible if player.id == outsider.id)
            assert guest.team_id == team.id
            _validate_squad_player(db, match, team.id, outsider.id)
            _assert_live_player(db, match, outsider.id, team.id)
            with pytest.raises(HTTPException):
                _validate_squad_player(db, match, other.id, outsider.id)
            with pytest.raises(HTTPException):
                _validate_squad_player(db, match, team.id, standby[0])
            with pytest.raises(HTTPException) as double_assignment:
                admin_save_season_players(season.id, other.id, SeasonPlayerRosterIn(
                    registered_player_ids=[outsider.id],
                ), db, user)
            assert double_assignment.value.status_code == 409
            with pytest.raises(ValidationError):
                SeasonPlayerRosterIn(registered_player_ids=[player.id for player in players[:16]])
    finally:
        engine.dispose()
