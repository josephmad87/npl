"""Store live rain-revised match conditions.

Revision ID: 20260723_0028
Revises: 20260722_0027
Create Date: 2026-07-23
"""

import sqlalchemy as sa
from alembic import op


revision = "20260723_0028"
down_revision = "20260722_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("revised_target_runs", sa.Integer(), nullable=True))
    op.add_column(
        "matches",
        sa.Column("dls_team2_resource_percentage", sa.Numeric(6, 3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("matches", "dls_team2_resource_percentage")
    op.drop_column("matches", "revised_target_runs")
