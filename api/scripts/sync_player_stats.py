#!/usr/bin/env python3
"""Recompute all player career totals from completed-match scorecards.

Run after migrations: PYTHONPATH=. python scripts/sync_player_stats.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.services.player_stats import recompute_all_player_career_stats


def main() -> None:
    db = SessionLocal()
    try:
        count = recompute_all_player_career_stats(db)
        db.commit()
        print(f"Recomputed career stats for {count} player(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
