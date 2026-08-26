"""Add draft publication and playoff bracket metadata to fixtures.

Revision ID: 20260826_0035
Revises: 20260818_0034
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from alembic import op


revision = "20260826_0035"
down_revision = "20260818_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("matches", sa.Column("fixture_stage", sa.String(length=64), nullable=True))
    op.add_column("matches", sa.Column("home_team_source", sa.String(length=128), nullable=True))
    op.add_column("matches", sa.Column("away_team_source", sa.String(length=128), nullable=True))
    op.add_column("matches", sa.Column("home_team_placeholder", sa.String(length=255), nullable=True))
    op.add_column("matches", sa.Column("away_team_placeholder", sa.String(length=255), nullable=True))
    op.create_index("ix_matches_is_published", "matches", ["is_published"], unique=False)
    op.create_index("ix_matches_fixture_stage", "matches", ["fixture_stage"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_matches_fixture_stage", table_name="matches")
    op.drop_index("ix_matches_is_published", table_name="matches")
    op.drop_column("matches", "away_team_placeholder")
    op.drop_column("matches", "home_team_placeholder")
    op.drop_column("matches", "away_team_source")
    op.drop_column("matches", "home_team_source")
    op.drop_column("matches", "fixture_stage")
    op.drop_column("matches", "is_published")
