"""Season club affiliations without changing a player's home club."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.league import League, Season, SeasonPlayer
from app.models.match import Match
from app.models.player import Player


def uses_registered_roster(db: Session, season_id: int, team_id: int) -> bool:
    season = db.get(Season, season_id)
    if season is None:
        return False
    league = db.get(League, season.league_id)
    if league and league.slug == "npl-t20-blast" and (
        "2026" in season.name or "2026" in season.slug or
        (season.start_date is not None and season.start_date.year == 2026)
    ):
        return True
    return db.scalar(
        select(SeasonPlayer.player_id).where(
            SeasonPlayer.season_id == season_id,
            SeasonPlayer.team_id == team_id,
        ).limit(1)
    ) is not None


def match_team_players(db: Session, match: Match, team_id: int) -> list[Player]:
    if team_id not in {match.home_team_id, match.away_team_id}:
        return []
    if match.season_id is not None and uses_registered_roster(db, match.season_id, team_id):
        stmt = (
            select(Player)
            .join(SeasonPlayer, SeasonPlayer.player_id == Player.id)
            .where(
                SeasonPlayer.season_id == match.season_id,
                SeasonPlayer.team_id == team_id,
                SeasonPlayer.role == "registered",
                Player.status == "active",
            )
            .order_by(Player.full_name)
        )
    else:
        stmt = select(Player).where(Player.team_id == team_id).order_by(Player.full_name)
    return list(db.scalars(stmt).all())


def player_can_represent_match_team(db: Session, match: Match, team_id: int, player_id: int) -> bool:
    if team_id not in {match.home_team_id, match.away_team_id}:
        return False
    player = db.get(Player, player_id)
    if player is None:
        return False
    if match.season_id is not None and uses_registered_roster(db, match.season_id, team_id):
        registration = db.get(SeasonPlayer, (match.season_id, player_id))
        return player.status == "active" and registration is not None and (
            registration.team_id == team_id and registration.role == "registered"
        )
    return player.team_id == team_id
