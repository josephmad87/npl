"""Add replacement batter to live ball events

Revision ID: 20260717_0025
Revises: 20260717_0024
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260717_0025"
down_revision = "20260717_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_ball_events",
        sa.Column("replacement_player_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_match_ball_events_replacement_player_id",
        "match_ball_events",
        ["replacement_player_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_match_ball_events_replacement_player_id_players",
        "match_ball_events",
        "players",
        ["replacement_player_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_match_ball_events_replacement_player_id_players",
        "match_ball_events",
        type_="foreignkey",
    )
    op.drop_index("ix_match_ball_events_replacement_player_id", table_name="match_ball_events")
    op.drop_column("match_ball_events", "replacement_player_id")
