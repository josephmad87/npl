"""Add transactional score versions and leased scorer sessions.

Revision ID: 20260902_0039
Revises: 20260902_0038
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260902_0039"
down_revision: str | None = "20260902_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("scoring_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "matches",
        sa.Column("scorecard_reconciled_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "matches",
        sa.Column("scorecard_reconciled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "matches",
        sa.Column(
            "scorecard_reconciliation_status",
            sa.String(length=32),
            server_default="in_sync",
            nullable=False,
        ),
    )

    op.create_table(
        "match_scoring_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("session_token", sa.String(length=64), nullable=False),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("device_label", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_by_user_id", sa.Integer(), nullable=True),
        sa.Column("takeover_reason", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["ended_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_match_scoring_sessions_match_id",
        "match_scoring_sessions",
        ["match_id"],
    )
    op.create_index(
        "ix_match_scoring_sessions_owner_user_id",
        "match_scoring_sessions",
        ["owner_user_id"],
    )
    op.create_index(
        "ix_match_scoring_sessions_session_token",
        "match_scoring_sessions",
        ["session_token"],
        unique=True,
    )
    op.create_index(
        "ix_match_scoring_sessions_status",
        "match_scoring_sessions",
        ["status"],
    )
    op.create_index(
        "ix_match_scoring_sessions_expires_at",
        "match_scoring_sessions",
        ["expires_at"],
    )
    op.create_index(
        "ix_match_scoring_sessions_ended_by_user_id",
        "match_scoring_sessions",
        ["ended_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_match_scoring_sessions_ended_by_user_id", table_name="match_scoring_sessions")
    op.drop_index("ix_match_scoring_sessions_expires_at", table_name="match_scoring_sessions")
    op.drop_index("ix_match_scoring_sessions_status", table_name="match_scoring_sessions")
    op.drop_index("ix_match_scoring_sessions_session_token", table_name="match_scoring_sessions")
    op.drop_index("ix_match_scoring_sessions_owner_user_id", table_name="match_scoring_sessions")
    op.drop_index("ix_match_scoring_sessions_match_id", table_name="match_scoring_sessions")
    op.drop_table("match_scoring_sessions")
    op.drop_column("matches", "scorecard_reconciliation_status")
    op.drop_column("matches", "scorecard_reconciled_at")
    op.drop_column("matches", "scorecard_reconciled_version")
    op.drop_column("matches", "scoring_version")
