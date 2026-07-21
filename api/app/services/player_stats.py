"""Aggregate career totals on Player rows from completed-match scorecards."""

from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.match import Match, MatchPlayerStat, MatchResult
from app.models.player import Player
from app.services.cricket_overs import normalize_cricket_overs

DID_NOT_BAT = "did not bat"
NOT_OUT = "not out"
RETIRED_HURT = "retired hurt"


def _normalize_dismissal(dismissal: str | None) -> str:
    return dismissal.strip().lower() if dismissal and dismissal.strip() else ""


def is_did_not_bat(dismissal: str | None) -> bool:
    return _normalize_dismissal(dismissal) == DID_NOT_BAT


def is_batting_out(dismissal: str | None) -> bool:
    t = _normalize_dismissal(dismissal)
    if not t or t in (NOT_OUT, RETIRED_HURT, DID_NOT_BAT):
        return False
    return True


def counts_batting_innings(
    dismissal: str | None,
    runs: int,
    balls_faced: int,
) -> bool:
    if is_did_not_bat(dismissal):
        return False
    t = _normalize_dismissal(dismissal)
    if runs > 0 or balls_faced > 0:
        return True
    if t in (NOT_OUT, RETIRED_HURT):
        return True
    return is_batting_out(dismissal)


def overs_to_balls(overs: Decimal | float | int | None) -> int:
    """Convert cricket overs (e.g. 4.3 = 4 overs and 3 balls) to total balls."""
    normalized = normalize_cricket_overs(overs)
    if normalized is None:
        return 0
    raw = float(normalized)
    if raw <= 0:
        return 0
    s = format(normalized, "f").rstrip("0").rstrip(".")
    if "." not in s:
        return int(s) * 6
    whole, frac = s.split(".", 1)
    w = int(whole) if whole else 0
    b = min(5, int(frac[0]) if frac else 0)
    return w * 6 + b


def _round_rate(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def recompute_player_career_stats(db: Session, player_ids: Iterable[int]) -> None:
    """Recompute stored career totals for the given players from scorecard rows."""
    ids = list({pid for pid in player_ids if pid > 0})
    if not ids:
        return

    for player_id in ids:
        player = db.get(Player, player_id)
        if player is None:
            continue

        stat_rows = db.execute(
            select(MatchPlayerStat, Match)
            .join(Match, MatchPlayerStat.match_id == Match.id)
            .where(
                MatchPlayerStat.player_id == player_id,
                Match.status == "completed",
            ),
        ).all()

        match_ids: set[int] = set()
        runs = 0
        balls_faced = 0
        outs = 0
        highest_score = 0
        wickets = 0
        runs_conceded = 0
        bowling_balls = 0
        catches = 0
        stumpings = 0
        run_outs = 0
        best_wickets = 0
        best_runs_conceded: int | None = None

        for st, _match in stat_rows:
            match_ids.add(st.match_id)
            if counts_batting_innings(st.dismissal, st.runs, st.balls_faced):
                runs += st.runs
                balls_faced += st.balls_faced
                highest_score = max(highest_score, st.runs)
                if is_batting_out(st.dismissal):
                    outs += 1
            wickets += st.wickets
            runs_conceded += st.runs_conceded
            bowling_balls += overs_to_balls(st.overs)
            catches += st.catches
            stumpings += st.stumpings
            run_outs += st.run_outs

            wkts = st.wickets
            conceded = st.runs_conceded
            if wkts > best_wickets or (
                wkts == best_wickets
                and wkts > 0
                and (best_runs_conceded is None or conceded < best_runs_conceded)
            ):
                best_wickets = wkts
                best_runs_conceded = conceded

        potm_raw = db.scalar(
            select(func.count())
            .select_from(MatchResult)
            .join(Match, MatchResult.match_id == Match.id)
            .where(
                MatchResult.player_of_match_player_id == player_id,
                Match.status == "completed",
            ),
        )
        potm_count = int(potm_raw) if potm_raw is not None else 0

        batting_average = (runs / outs) if outs > 0 else None
        strike_rate = (runs / balls_faced * 100) if balls_faced > 0 else None
        bowling_average = (runs_conceded / wickets) if wickets > 0 else None
        economy_rate = (runs_conceded * 6 / bowling_balls) if bowling_balls > 0 else None
        best_bowling = (
            f"{best_wickets}/{best_runs_conceded}"
            if best_wickets > 0 and best_runs_conceded is not None
            else None
        )

        player.matches_played = len(match_ids)
        player.runs_scored = runs
        player.batting_average = _round_rate(batting_average)
        player.strike_rate = _round_rate(strike_rate)
        player.highest_score = highest_score if highest_score > 0 else None
        player.wickets_taken = wickets
        player.bowling_average = _round_rate(bowling_average)
        player.economy_rate = _round_rate(economy_rate)
        player.best_bowling = best_bowling
        player.catches = catches
        player.stumpings = stumpings
        player.run_outs = run_outs
        player.player_of_match_awards = potm_count


def recompute_all_player_career_stats(db: Session) -> int:
    """Recompute career totals for every player. Returns number of players updated."""
    player_ids = list(db.scalars(select(Player.id)).all())
    recompute_player_career_stats(db, player_ids)
    return len(player_ids)


def affected_player_ids_for_match(db: Session, match_id: int) -> set[int]:
    """Players whose stored totals may change when a match scorecard or result changes."""
    affected: set[int] = set(
        db.scalars(
            select(MatchPlayerStat.player_id).where(MatchPlayerStat.match_id == match_id),
        ).all(),
    )
    pom = db.scalar(
        select(MatchResult.player_of_match_player_id).where(MatchResult.match_id == match_id),
    )
    if pom is not None:
        affected.add(pom)
    return affected
