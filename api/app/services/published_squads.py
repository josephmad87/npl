"""Read-only season squad projection; never changes scorer eligibility."""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.league import SeasonPlayer
from app.models.match import Match, MatchDaySquadPlayer, MatchPlayerStat
from app.models.player import Player
from app.schemas.players import PlayerOut


def season_squad(db: Session, season_id: int, team_id: int) -> dict:
    registrations = db.scalars(select(SeasonPlayer).where(SeasonPlayer.season_id == season_id)).all()
    registered = {row.player_id: row for row in registrations}
    own = [row for row in registrations if row.team_id == team_id]
    evidence = defaultdict(set)
    matches = defaultdict(set)
    for model in (MatchPlayerStat, MatchDaySquadPlayer):
        query = (
            select(model.player_id, model.team_id, Match.id)
            .join(Match, Match.id == model.match_id)
            .where(
                Match.season_id == season_id,
                Match.is_published.is_(True),
                Match.status == "completed",
                model.team_id.in_((Match.home_team_id, Match.away_team_id)),
            )
        )
        if model is MatchDaySquadPlayer:
            query = query.where(model.role == "playing_xi")
        for player_id, recorded_team, match_id in db.execute(query):
            evidence[player_id].add(recorded_team)
            matches[(player_id, recorded_team)].add(match_id)
    flags = []
    selected = {}
    if own:
        selected = {row.player_id: row.role for row in own}
    else:
        flags.append(
            {
                "code": "missing_registration_list",
                "message": "No official registration list is available. Players below are identified from published completed-match records.",
            }
        )
        for player_id, teams in evidence.items():
            if team_id not in teams:
                continue
            registration = registered.get(player_id)
            if len(teams) > 1 or (registration and registration.team_id != team_id):
                flags.append(
                    {
                        "code": "conflicting_team_evidence",
                        "player_id": player_id,
                        "message": "Player recorded for multiple teams or registered elsewhere; excluded pending review.",
                    }
                )
                continue
            selected[player_id] = "recorded"
    for player_id, teams in evidence.items():
        if team_id in teams and own and len(teams) > 1:
            flags.append(
                {
                    "code": "conflicting_team_evidence",
                    "player_id": player_id,
                    "message": "Player has match records for multiple teams; official registration retained for review.",
                }
            )
        if team_id in teams and own and player_id not in selected:
            flags.append(
                {
                    "code": "unregistered_match_player",
                    "player_id": player_id,
                    "message": "Match participant is absent from this team's registration list; official list retained.",
                }
            )
    players = []
    if selected:
        for player in db.scalars(select(Player).where(Player.id.in_(selected)).order_by(Player.full_name)):
            item = PlayerOut.model_validate(player).model_dump(mode="json")
            item.update(
                season_roster_role=selected[player.id],
                profile_available=player.status == "active",
                evidence_match_count=len(matches[(player.id, team_id)]),
            )
            players.append(item)
    if not players:
        flags.append(
            {
                "code": "missing_player_evidence",
                "message": "No reliable season player list is available. Current club profiles have not been copied into this season.",
            }
        )
    return {
        "season_id": season_id,
        "team_id": team_id,
        "source": "registrations" if own else "match_records",
        "players": players,
        "flags": flags,
    }
