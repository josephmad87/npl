"""Add fan player of the match votes.

Revision ID: 20260717_0019
Revises: 20260714_0018
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0019"
down_revision: Union[str, None] = "20260714_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fan_player_match_votes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("voter_key", sa.String(length=128), nullable=False),
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
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "match_id",
            "voter_key",
            name="uq_fan_player_match_votes_match_voter",
        ),
    )

    op.create_index(
        "ix_fan_player_match_votes_match_id",
        "fan_player_match_votes",
        ["match_id"],
    )
    op.create_index(
        "ix_fan_player_match_votes_player_id",
        "fan_player_match_votes",
        ["player_id"],
    )
    op.create_index(
        "ix_fan_player_match_votes_voter_key",
        "fan_player_match_votes",
        ["voter_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_fan_player_match_votes_voter_key", table_name="fan_player_match_votes")
    op.drop_index("ix_fan_player_match_votes_player_id", table_name="fan_player_match_votes")
    op.drop_index("ix_fan_player_match_votes_match_id", table_name="fan_player_match_votes")
    op.drop_table("fan_player_match_votes")
