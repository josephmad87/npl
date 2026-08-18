"""Add live-scoring law controls for leg-byes and umpire over calls.

Revision ID: 20260818_0034
Revises: 20260817_0033
Create Date: 2026-08-18
"""

import sqlalchemy as sa
from alembic import op


revision = "20260818_0034"
down_revision = "20260817_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_ball_events",
        sa.Column("leg_bye_attempted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("over_complete_override", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("match_ball_events", "over_complete_override")
    op.drop_column("match_ball_events", "leg_bye_attempted")
