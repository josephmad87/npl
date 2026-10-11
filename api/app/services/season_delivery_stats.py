"""Compact season statistics derived from recorded scoring deliveries."""

from collections import defaultdict
from typing import Iterable

from app.models.match import MatchBallEvent


def _empty_counts() -> dict[str, int]:
    return {
        "ones": 0,
        "twos": 0,
        "threes": 0,
        "dots": 0,
        "balls_faced": 0,
        "boundaries": 0,
        "partnerships_50": 0,
        "partnerships_100": 0,
    }


def summarize_season_deliveries(events: Iterable[MatchBallEvent]) -> dict:
    """Count recorded shots and stands for tournament, batting side and batter.

    Events must be ordered by match, innings, then sequence. A no-ball is faced
    by the batter, while a wide and a dead ball are not. Dot balls have no runs
    of any kind credited to the batting side.
    """
    tournament = _empty_counts()
    teams: dict[int, dict[str, int]] = defaultdict(_empty_counts)
    players: dict[int, dict[str, int]] = defaultdict(_empty_counts)
    recorded_matches: set[int] = set()
    stand_key: tuple[int, int, int, tuple[int, ...]] | None = None
    stand_runs = 0

    def close_stand() -> None:
        nonlocal stand_key, stand_runs
        if stand_key is None:
            return
        team_id = stand_key[2]
        player_ids = stand_key[3]
        if stand_runs >= 50:
            tournament["partnerships_50"] += 1
            teams[team_id]["partnerships_50"] += 1
            for player_id in player_ids:
                players[player_id]["partnerships_50"] += 1
        if stand_runs >= 100:
            tournament["partnerships_100"] += 1
            teams[team_id]["partnerships_100"] += 1
            for player_id in player_ids:
                players[player_id]["partnerships_100"] += 1
        stand_key = None
        stand_runs = 0

    for event in events:
        recorded_matches.add(event.match_id)
        pair = tuple(sorted({pid for pid in (event.striker_player_id, event.non_striker_player_id) if pid}))
        event_stand_key = (event.match_id, event.innings, event.batting_team_id, pair)
        # An innings or batting pair change starts a new stand. A wicket ends
        # the previous stand after that delivery's runs have been counted.
        if stand_key != event_stand_key:
            close_stand()
            stand_key = event_stand_key

        if not event.is_dead_ball:
            batter_runs = event.runs_batter or 0
            team_runs = batter_runs + (event.runs_extras or 0) + (event.penalty_runs_batting or 0)
            stand_runs += team_runs
            shot_key = {1: "ones", 2: "twos", 3: "threes"}.get(batter_runs)
            if shot_key:
                for target in (tournament, teams[event.batting_team_id], players[event.striker_player_id]):
                    target[shot_key] += 1
            counts_as_faced = event.is_legal_delivery or (event.extras_type or "").lower() in {
                "no_ball", "no_ball_bye", "no_ball_leg_bye",
            }
            if counts_as_faced:
                is_boundary = event.boundary_runs in (4, 6) or batter_runs in (4, 6)
                for target in (tournament, teams[event.batting_team_id], players[event.striker_player_id]):
                    target["balls_faced"] += 1
                    if team_runs == 0:
                        target["dots"] += 1
                    if is_boundary:
                        target["boundaries"] += 1
        if event.wicket_type:
            close_stand()

    close_stand()
    return {
        "recorded_match_count": len(recorded_matches),
        "tournament": tournament,
        "teams": teams,
        "players": players,
    }
