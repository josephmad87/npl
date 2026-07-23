"""Add scorer scorecard finalization locks and edit requests.

Revision ID: 20260723_0030
Revises: 20260723_0029
Create Date: 2026-07-23
"""

import sqlalchemy as sa
from alembic import op


revision = "20260723_0030"
down_revision = "20260723_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("scorecard_finalized_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_matches_scorecard_finalized_at",
        "matches",
        ["scorecard_finalized_at"],
        unique=False,
    )
    # Existing completed scorecards receive a fresh two-hour correction window
    # because their original finalization time was not stored.
    op.execute(
        "UPDATE matches SET scorecard_finalized_at = CURRENT_TIMESTAMP "
        "WHERE status = 'completed' AND scorecard_finalized_at IS NULL",
    )
    op.create_table(
        "match_scorecard_edit_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("reason", sa.String(length=512), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("access_until", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["requested_by_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_match_scorecard_edit_requests_match_id",
        "match_scorecard_edit_requests",
        ["match_id"],
        unique=False,
    )
    op.create_index(
        "ix_match_scorecard_edit_requests_requested_by_user_id",
        "match_scorecard_edit_requests",
        ["requested_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_match_scorecard_edit_requests_status",
        "match_scorecard_edit_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_match_scorecard_edit_requests_reviewed_by_user_id",
        "match_scorecard_edit_requests",
        ["reviewed_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_match_scorecard_edit_requests_access_until",
        "match_scorecard_edit_requests",
        ["access_until"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_match_scorecard_edit_requests_access_until",
        table_name="match_scorecard_edit_requests",
    )
    op.drop_index(
        "ix_match_scorecard_edit_requests_reviewed_by_user_id",
        table_name="match_scorecard_edit_requests",
    )
    op.drop_index(
        "ix_match_scorecard_edit_requests_status",
        table_name="match_scorecard_edit_requests",
    )
    op.drop_index(
        "ix_match_scorecard_edit_requests_requested_by_user_id",
        table_name="match_scorecard_edit_requests",
    )
    op.drop_index(
        "ix_match_scorecard_edit_requests_match_id",
        table_name="match_scorecard_edit_requests",
    )
    op.drop_table("match_scorecard_edit_requests")
    op.drop_index("ix_matches_scorecard_finalized_at", table_name="matches")
    op.drop_column("matches", "scorecard_finalized_at")
