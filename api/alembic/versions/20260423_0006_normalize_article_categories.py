"""Normalize article.category to mens, women, youth.

Revision ID: 20260423_0006
Revises: 20260422_0005
Create Date: 2026-04-23

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260423_0006"
down_revision: Union[str, None] = "20260422_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE articles SET category = 'mens'
        WHERE category IS NULL OR trim(category) = ''
        """
    )
    op.execute(
        """
        UPDATE articles SET category = 'women'
        WHERE lower(trim(category)) IN ('women', 'ladies', 'lady', 'woman', 'womens')
        """
    )
    op.execute(
        """
        UPDATE articles SET category = 'youth'
        WHERE lower(trim(category)) = 'youth'
        """
    )
    op.execute(
        """
        UPDATE articles SET category = 'mens'
        WHERE lower(trim(category)) IN ('men', 'man', 'mens')
        """
    )
    op.execute(
        """
        UPDATE articles SET category = 'mens'
        WHERE lower(trim(category)) NOT IN ('mens', 'women', 'youth')
        """
    )


def downgrade() -> None:
    pass
