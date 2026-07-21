"""Add match overs for live result finalization.

Revision ID: 20260717_0023
Revises: 20260717_0022
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0023"
down_revision: Union[str, None] = "20260717_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column(
            "match_overs",
            sa.Numeric(6, 2),
            nullable=False,
            server_default="40.0",
        ),
    )


def downgrade() -> None:
    op.drop_column("matches", "match_overs")
