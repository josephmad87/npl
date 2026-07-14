"""Add second image to merchandise products.

Revision ID: 20260714_0017
Revises: 20260714_0016
Create Date: 2026-07-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260714_0017"
down_revision: Union[str, None] = "20260714_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchandise_products",
        sa.Column(
            "image_url_2",
            sa.String(length=1024),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("merchandise_products", "image_url_2")
