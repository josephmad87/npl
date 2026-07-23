"""Store the effective DLS resource for the first innings.

Revision ID: 20260723_0029
Revises: 20260723_0028
Create Date: 2026-07-23
"""

import sqlalchemy as sa
from alembic import op


revision = "20260723_0029"
down_revision = "20260723_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("dls_team1_resource_percentage", sa.Numeric(6, 3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("matches", "dls_team1_resource_percentage")
