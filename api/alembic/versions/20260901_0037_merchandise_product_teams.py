"""Allow a merchandise product to be linked to multiple teams.

Revision ID: 20260901_0037
Revises: 20260826_0036
Create Date: 2026-09-01
"""

import sqlalchemy as sa
from alembic import op


revision = "20260901_0037"
down_revision = "20260826_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "merchandise_products",
        sa.Column("image_url_3", sa.String(length=1024), nullable=False, server_default=""),
    )
    op.create_table(
        "merchandise_product_teams",
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("merchandise_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "team_id",
            sa.Integer(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("product_id", "team_id"),
    )
    op.create_index(
        "ix_merchandise_product_teams_team_id",
        "merchandise_product_teams",
        ["team_id"],
        unique=False,
    )
    op.execute(
        "INSERT INTO merchandise_product_teams (product_id, team_id) "
        "SELECT id, team_id FROM merchandise_products WHERE team_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_merchandise_product_teams_team_id", table_name="merchandise_product_teams")
    op.drop_table("merchandise_product_teams")
    op.drop_column("merchandise_products", "image_url_3")
