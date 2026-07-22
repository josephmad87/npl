"""Backfill fielding totals and clear did-not-bat batting positions.

Revision ID: 20260722_0026
Revises: 20260717_0025
Create Date: 2026-07-22
"""

from alembic import op


revision = "20260722_0026"
down_revision = "20260717_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE match_player_stats
        SET batting_order = NULL
        WHERE LOWER(TRIM(COALESCE(dismissal, ''))) = 'did not bat'
        """
    )
    op.execute(
        """
        UPDATE players
        SET
            catches = COALESCE((
                SELECT SUM(match_player_stats.catches)
                FROM match_player_stats
                JOIN matches ON matches.id = match_player_stats.match_id
                WHERE match_player_stats.player_id = players.id
                  AND matches.status = 'completed'
            ), 0),
            stumpings = COALESCE((
                SELECT SUM(match_player_stats.stumpings)
                FROM match_player_stats
                JOIN matches ON matches.id = match_player_stats.match_id
                WHERE match_player_stats.player_id = players.id
                  AND matches.status = 'completed'
            ), 0),
            run_outs = COALESCE((
                SELECT SUM(match_player_stats.run_outs)
                FROM match_player_stats
                JOIN matches ON matches.id = match_player_stats.match_id
                WHERE match_player_stats.player_id = players.id
                  AND matches.status = 'completed'
            ), 0)
        """
    )


def downgrade() -> None:
    # This migration repairs derived data; restoring stale totals is unsafe.
    pass
