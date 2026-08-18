#!/usr/bin/env python3
"""Rebuild completed live-scorecard player figures from recorded ball events.

This preserves each match's official result, points and team totals while
recalculating the per-player scorecard rows and player career totals.

Run in the API environment:
    PYTHONPATH=. python scripts/rebuild_live_scorecards.py
"""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import select

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api.v1.admin_routes import _finalize_live_match_result
from app.db.session import SessionLocal
from app.models.match import Match, MatchBallEvent


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebuild completed live-scorecard player figures from ball events.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report how many completed live scorecards would be rebuilt without changing data.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        scored_match_ids = select(MatchBallEvent.match_id).distinct()
        matches = list(
            db.scalars(
                select(Match).where(
                    Match.status == "completed",
                    Match.id.in_(scored_match_ids),
                ),
            ).all(),
        )

        if args.dry_run:
            print(f"Would rebuild {len(matches)} completed live scorecard(s).")
            return

        for match in matches:
            _finalize_live_match_result(
                db,
                match,
                actor=None,  # The reconciliation is a system maintenance task.
                preserve_result=True,
            )

        db.commit()
        print(f"Rebuilt {len(matches)} completed live scorecard(s) and career totals.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
