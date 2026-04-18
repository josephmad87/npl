"""Add match_player_stats for per-player scorecard lines.

Revision ID: 20250418_0003
Revises: 20250418_0002
Create Date: 2026-04-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20250418_0003"
down_revision: Union[str, None] = "20250418_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "match_player_stats" in insp.get_table_names():
        return

    op.create_table(
        "match_player_stats",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("lineup_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("balls_faced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fours", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sixes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dismissal", sa.String(length=128), nullable=True),
        sa.Column("overs", sa.Numeric(6, 2), nullable=True),
        sa.Column("maidens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs_conceded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wickets", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("catches", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stumpings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("run_outs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("match_id", "player_id", name="uq_match_player_stats_match_player"),
    )
    op.create_index("ix_match_player_stats_match_id", "match_player_stats", ["match_id"])
    op.create_index("ix_match_player_stats_player_id", "match_player_stats", ["player_id"])
    op.create_index("ix_match_player_stats_team_id", "match_player_stats", ["team_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "match_player_stats" not in insp.get_table_names():
        return
    op.drop_table("match_player_stats")
