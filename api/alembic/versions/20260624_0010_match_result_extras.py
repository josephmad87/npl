"""Per-team extras on match results (wides, byes, no-balls, leg-byes).

Revision ID: 20260624_0010
Revises: 20260423_0009
Create Date: 2026-06-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260624_0010"
down_revision: Union[str, None] = "20260423_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EXTRAS_COLUMNS = (
    "home_extras_wides",
    "home_extras_byes",
    "home_extras_no_balls",
    "home_extras_leg_byes",
    "away_extras_wides",
    "away_extras_byes",
    "away_extras_no_balls",
    "away_extras_leg_byes",
)


def upgrade() -> None:
    for col in _EXTRAS_COLUMNS:
        op.add_column(
            "match_results",
            sa.Column(col, sa.Integer(), nullable=False, server_default="0"),
        )
    for col in _EXTRAS_COLUMNS:
        op.alter_column("match_results", col, server_default=None)


def downgrade() -> None:
    for col in reversed(_EXTRAS_COLUMNS):
        op.drop_column("match_results", col)
