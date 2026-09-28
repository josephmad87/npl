"""Add season-specific player registrations.

Revision ID: 20260928_0047
Revises: 20260925_0046
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260928_0047"
down_revision: str | None = "20260925_0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "season_players",
        sa.Column("season_id", sa.Integer(), sa.ForeignKey("seasons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.CheckConstraint("role IN ('registered', 'standby')", name="ck_season_players_role"),
    )
    op.create_index("ix_season_players_team_id", "season_players", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_season_players_team_id", table_name="season_players")
    op.drop_table("season_players")
