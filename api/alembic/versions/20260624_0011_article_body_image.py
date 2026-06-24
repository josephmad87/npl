"""Add optional in-body image URL for news articles.

Revision ID: 20260624_0011
Revises: 20260624_0010
Create Date: 2026-06-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260624_0011"
down_revision: Union[str, None] = "20260624_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("body_image_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("articles", "body_image_url")
