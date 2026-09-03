"""Add independent commentary and match streaming fields.

Revision ID: 20260903_0042
Revises: 20260903_0041
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_0042"
down_revision: str | None = "20260903_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("stream_url", sa.String(length=1024), nullable=True))
    op.add_column("matches", sa.Column("stream_label", sa.String(length=128), nullable=True))
    op.add_column("match_ball_events", sa.Column("commentary", sa.Text(), nullable=True))
    op.add_column(
        "match_ball_events",
        sa.Column("commentary_updated_by_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "match_ball_events",
        sa.Column("commentary_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_match_ball_events_commentary_user",
        "match_ball_events",
        "users",
        ["commentary_updated_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_match_ball_events_commentary_updated_by_user_id",
        "match_ball_events",
        ["commentary_updated_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_match_ball_events_commentary_updated_by_user_id",
        table_name="match_ball_events",
    )
    op.drop_constraint(
        "fk_match_ball_events_commentary_user",
        "match_ball_events",
        type_="foreignkey",
    )
    op.drop_column("match_ball_events", "commentary_updated_at")
    op.drop_column("match_ball_events", "commentary_updated_by_user_id")
    op.drop_column("match_ball_events", "commentary")
    op.drop_column("matches", "stream_label")
    op.drop_column("matches", "stream_url")
