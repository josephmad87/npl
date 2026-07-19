"""Add match day squads and wicket fielders.

Revision ID: 20260717_0021
Revises: 20260717_0020
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0021"
down_revision: Union[str, None] = "20260717_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "match_squad_players",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("lineup_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_captain", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_wicketkeeper", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("match_id", "player_id", name="uq_match_squad_players_match_player"),
    )
    op.create_index("ix_match_squad_players_match_id", "match_squad_players", ["match_id"])
    op.create_index("ix_match_squad_players_team_id", "match_squad_players", ["team_id"])
    op.create_index("ix_match_squad_players_player_id", "match_squad_players", ["player_id"])
    op.create_index("ix_match_squad_players_role", "match_squad_players", ["role"])
    op.create_index("ix_match_squad_players_created_by_user_id", "match_squad_players", ["created_by_user_id"])

    op.add_column("match_ball_events", sa.Column("fielder_player_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_match_ball_events_fielder_player_id_players",
        "match_ball_events",
        "players",
        ["fielder_player_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_match_ball_events_fielder_player_id", "match_ball_events", ["fielder_player_id"])


def downgrade() -> None:
    op.drop_index("ix_match_ball_events_fielder_player_id", table_name="match_ball_events")
    op.drop_constraint(
        "fk_match_ball_events_fielder_player_id_players",
        "match_ball_events",
        type_="foreignkey",
    )
    op.drop_column("match_ball_events", "fielder_player_id")

    op.drop_index("ix_match_squad_players_created_by_user_id", table_name="match_squad_players")
    op.drop_index("ix_match_squad_players_role", table_name="match_squad_players")
    op.drop_index("ix_match_squad_players_player_id", table_name="match_squad_players")
    op.drop_index("ix_match_squad_players_team_id", table_name="match_squad_players")
    op.drop_index("ix_match_squad_players_match_id", table_name="match_squad_players")
    op.drop_table("match_squad_players")
