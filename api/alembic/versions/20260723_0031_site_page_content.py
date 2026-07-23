"""Add managed public policy and support page content.

Revision ID: 20260723_0031
Revises: 20260723_0030
Create Date: 2026-07-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260723_0031"
down_revision = "20260723_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_page_content",
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column(
            "body",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "slug IN ('privacy', 'terms', 'support', 'account-deletion')",
            name="site_page_content_known_slug",
        ),
        sa.PrimaryKeyConstraint("slug"),
    )
    op.execute(
        "INSERT INTO site_page_content (slug) VALUES "
        "('privacy'), ('terms'), ('support'), ('account-deletion')",
    )


def downgrade() -> None:
    op.drop_table("site_page_content")
