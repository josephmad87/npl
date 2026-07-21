"""Add player career run outs.

Revision ID: 20260717_0024
Revises: 20260717_0023
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0024"
down_revision: Union[str, None] = "20260717_0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "players",
        sa.Column("run_outs", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("players", "run_outs")
