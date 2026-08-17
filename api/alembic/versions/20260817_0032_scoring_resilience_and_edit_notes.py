"""Add idempotent live-ball retries and scorecard review notes.

Revision ID: 20260817_0032
Revises: 20260723_0031
Create Date: 2026-08-17
"""

import sqlalchemy as sa
from alembic import op


revision = "20260817_0032"
down_revision = "20260723_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_ball_events",
        sa.Column("client_event_id", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_match_ball_events_client_event_id",
        "match_ball_events",
        ["client_event_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_match_ball_events_match_client_event",
        "match_ball_events",
        ["match_id", "client_event_id"],
    )
    op.add_column(
        "match_scorecard_edit_requests",
        sa.Column("decision_note", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("match_scorecard_edit_requests", "decision_note")
    op.drop_constraint(
        "uq_match_ball_events_match_client_event",
        "match_ball_events",
        type_="unique",
    )
    op.drop_index("ix_match_ball_events_client_event_id", table_name="match_ball_events")
    op.drop_column("match_ball_events", "client_event_id")
