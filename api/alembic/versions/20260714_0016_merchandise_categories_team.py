"""Add category and team link to merchandise products.

Revision ID: 20260714_0016
Revises: 20260714_0015
Create Date: 2026-07-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260714_0016"
down_revision: Union[str, None] = "20260714_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchandise_products",
        sa.Column(
            "category",
            sa.String(length=64),
            nullable=False,
            server_default="Other",
        ),
    )
    op.add_column(
        "merchandise_products",
        sa.Column(
            "audience",
            sa.String(length=64),
            nullable=False,
            server_default="Unisex",
        ),
    )
    op.add_column(
        "merchandise_products",
        sa.Column("team_id", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_merchandise_products_team_id",
        "merchandise_products",
        ["team_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_merchandise_products_team_id_teams",
        "merchandise_products",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_merchandise_products_team_id_teams",
        "merchandise_products",
        type_="foreignkey",
    )
    op.drop_index("ix_merchandise_products_team_id", table_name="merchandise_products")
    op.drop_column("merchandise_products", "team_id")
    op.drop_column("merchandise_products", "audience")
    op.drop_column("merchandise_products", "category")
