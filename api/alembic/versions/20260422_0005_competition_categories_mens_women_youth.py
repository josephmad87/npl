"""Normalize competition category values to mens, women, youth.

Revision ID: 20260422_0005
Revises: 20250418_0004
Create Date: 2026-04-22

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260422_0005"
down_revision: Union[str, None] = "20250418_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("teams", "leagues", "matches", "players")


def upgrade() -> None:
    for table in _TABLES:
        op.execute(
            f"UPDATE {table} SET category = 'mens' "
            f"WHERE lower(trim(category)) IN ('men', 'man'))"
        )
        op.execute(
            f"UPDATE {table} SET category = 'women' "
            f"WHERE lower(trim(category)) IN ('ladies', 'lady', 'woman', 'womens', 'women'))"
        )
        op.execute(
            f"UPDATE {table} SET category = 'youth' "
            f"WHERE lower(trim(category)) = 'youth'"
        )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"UPDATE {table} SET category = 'men' WHERE lower(trim(category)) = 'mens'")
        op.execute(f"UPDATE {table} SET category = 'ladies' WHERE lower(trim(category)) = 'women'")
