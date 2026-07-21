"""Add MCC scoring fields to live ball events.

Revision ID: 20260717_0022
Revises: 20260717_0021
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0022"
down_revision: Union[str, None] = "20260717_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_ball_events",
        sa.Column("completed_runs", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("boundary_runs", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("boundary_type", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("penalty_runs_batting", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("penalty_runs_fielding", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("short_runs", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("is_dead_ball", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("wicket_end", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("batters_crossed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_match_ball_events_is_dead_ball", "match_ball_events", ["is_dead_ball"])
    op.create_index("ix_match_ball_events_boundary_type", "match_ball_events", ["boundary_type"])


def downgrade() -> None:
    op.drop_index("ix_match_ball_events_boundary_type", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_is_dead_ball", table_name="match_ball_events")
    op.drop_column("match_ball_events", "batters_crossed")
    op.drop_column("match_ball_events", "wicket_end")
    op.drop_column("match_ball_events", "is_dead_ball")
    op.drop_column("match_ball_events", "short_runs")
    op.drop_column("match_ball_events", "penalty_runs_fielding")
    op.drop_column("match_ball_events", "penalty_runs_batting")
    op.drop_column("match_ball_events", "boundary_type")
    op.drop_column("match_ball_events", "boundary_runs")
    op.drop_column("match_ball_events", "completed_runs")
