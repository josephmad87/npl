"""Add separate batting and bowling order to player scorecards.

Revision ID: 20260713_0013
Revises: 20260624_0012
Create Date: 2026-07-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260713_0013"
down_revision: Union[str, None] = "20260624_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_player_stats",
        sa.Column("batting_order", sa.Integer(), nullable=True),
    )
    op.add_column(
        "match_player_stats",
        sa.Column("bowling_order", sa.Integer(), nullable=True),
    )

    op.execute(
        """
        UPDATE match_player_stats
        SET
            batting_order = CASE
                WHEN runs > 0
                  OR balls_faced > 0
                  OR fours > 0
                  OR sixes > 0
                  OR dismissal IS NOT NULL
                THEN lineup_order
                ELSE NULL
            END,
            bowling_order = CASE
                WHEN overs IS NOT NULL AND overs > 0
                THEN lineup_order
                ELSE NULL
            END
        """
    )


def downgrade() -> None:
    op.drop_column("match_player_stats", "bowling_order")
    op.drop_column("match_player_stats", "batting_order")
