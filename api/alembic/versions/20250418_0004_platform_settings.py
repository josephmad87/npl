"""Singleton platform_settings for admin branding and integrations.

Revision ID: 20250418_0004
Revises: 20250418_0003
Create Date: 2026-04-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "20250418_0004"
down_revision: Union[str, None] = "20250418_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "platform_settings" in insp.get_table_names():
        return

    op.create_table(
        "platform_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("default_season", sa.String(length=120), nullable=False, server_default=""),
        sa.Column(
            "media_cdn_base_url",
            sa.String(length=1000),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "feature_flags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "notification_hooks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO platform_settings (id, site_name, default_season, media_cdn_base_url, feature_flags, notification_hooks) "
            "VALUES (1, 'National Premier League', '', '', '{}'::jsonb, '[]'::jsonb)"
        )
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
