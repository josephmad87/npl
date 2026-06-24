"""Scorecard innings, sponsor links, contact messages, featured teams.

Revision ID: 20260624_0012
Revises: 20260624_0011
Create Date: 2026-06-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260624_0012"
down_revision: Union[str, None] = "20260624_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_results",
        sa.Column("batting_first_team_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_match_results_batting_first_team_id",
        "match_results",
        "teams",
        ["batting_first_team_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_match_results_batting_first_team_id",
        "match_results",
        ["batting_first_team_id"],
    )

    op.add_column(
        "sponsors",
        sa.Column("link_url", sa.String(length=1024), nullable=True),
    )

    op.create_table(
        "contact_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contact_messages_created_at", "contact_messages", ["created_at"])

    op.add_column(
        "teams",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "teams",
        sa.Column("featured_sort_order", sa.Integer(), nullable=True),
    )
    op.create_index("ix_teams_is_featured", "teams", ["is_featured"])
    op.alter_column("teams", "is_featured", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_teams_is_featured", table_name="teams")
    op.drop_column("teams", "featured_sort_order")
    op.drop_column("teams", "is_featured")

    op.drop_index("ix_contact_messages_created_at", table_name="contact_messages")
    op.drop_table("contact_messages")

    op.drop_column("sponsors", "link_url")

    op.drop_index("ix_match_results_batting_first_team_id", table_name="match_results")
    op.drop_constraint("fk_match_results_batting_first_team_id", "match_results", type_="foreignkey")
    op.drop_column("match_results", "batting_first_team_id")
