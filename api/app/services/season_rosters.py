"""Season club affiliations without changing a player's home club."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.league import League, Season, SeasonPlayer
from app.models.match import Match, MatchDaySquadPlayer, MatchPlayerStat
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


def match_team_players(
    db: Session, match: Match, team_id: int, *, include_standby: bool = False,
) -> list[Player]:
    if team_id not in {match.home_team_id, match.away_team_id}:
        return []
    if match.season_id is not None and uses_registered_roster(db, match.season_id, team_id):
        stmt = (
            select(Player)
            .join(SeasonPlayer, SeasonPlayer.player_id == Player.id)
            .where(
                SeasonPlayer.season_id == match.season_id,
                SeasonPlayer.team_id == team_id,
                SeasonPlayer.role.in_(("registered", "standby") if include_standby else ("registered",)),
                Player.status.in_(("active", "inactive") if include_standby else ("active",)),
            )
            .order_by(Player.full_name)
        )
    else:
        stmt = select(Player).where(Player.team_id == team_id).order_by(Player.full_name)
    return list(db.scalars(stmt).all())


def match_eligible_players(
    db: Session, match: Match, *, include_standby: bool = False,
) -> list[tuple[int, Player]]:
    """Keep recorded participants available even if their season roster later changes."""
    players_by_side = {
        team_id: {
            player.id: player for player in match_team_players(
                db, match, team_id, include_standby=include_standby,
            )
        }
        for team_id in (match.home_team_id, match.away_team_id)
    }
    recorded = list(db.execute(
        select(MatchDaySquadPlayer.player_id, MatchDaySquadPlayer.team_id)
        .where(MatchDaySquadPlayer.match_id == match.id)
    ).all())
    recorded.extend(db.execute(
        select(MatchPlayerStat.player_id, MatchPlayerStat.team_id)
        .where(MatchPlayerStat.match_id == match.id)
    ).all())
    for player_id, team_id in recorded:
        if team_id in players_by_side and player_id not in players_by_side[team_id]:
            player = db.get(Player, player_id)
            if player is not None:
                players_by_side[team_id][player_id] = player
    return [
        (team_id, player)
        for team_id, players in players_by_side.items()
        for player in sorted(players.values(), key=lambda player: player.full_name)
    ]


def player_can_represent_match_team(db: Session, match: Match, team_id: int, player_id: int) -> bool:
    if team_id not in {match.home_team_id, match.away_team_id}:
        return False
    player = db.get(Player, player_id)
    if player is None:
        return False
    if match.season_id is not None and uses_registered_roster(db, match.season_id, team_id):
        registration = db.get(SeasonPlayer, (match.season_id, player_id))
        return player.status in {"active", "inactive"} and registration is not None and (
            registration.team_id == team_id and registration.role in {"registered", "standby"}
        )
    return player.team_id == team_id
