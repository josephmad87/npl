"""Site About singleton and Sponsors.

Revision ID: 20260423_0008
Revises: 20260423_0007
Create Date: 2026-04-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260423_0008"
down_revision: Union[str, None] = "20260423_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "about_content",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "body",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("id = 1", name="about_content_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("INSERT INTO about_content (id) VALUES (1)")

    op.create_table(
        "sponsors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("image_url", sa.String(length=1024), nullable=False, server_default=""),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sponsors_team_id"), "sponsors", ["team_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sponsors_team_id"), table_name="sponsors")
    op.drop_table("sponsors")
    op.drop_table("about_content")
