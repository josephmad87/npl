"""Keep unresolved playoff teams as bracket placeholders.

Revision ID: 20260826_0036
Revises: 20260826_0035
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from alembic import op


revision = "20260826_0036"
down_revision = "20260826_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing draft brackets used their temporary seed team IDs for display.
    # Preserve those IDs internally, but display the bracket place until the
    # regular-season standings are final.
    for stage, home, away in (
        ("qualifier_1", "1st Place", "2nd Place"),
        ("eliminator", "3rd Place", "4th Place"),
        ("qualifier_2", "Loser Qualifier 1", "Winner Eliminator"),
        ("final", "Winner Qualifier 1", "Winner Qualifier 2"),
    ):
        op.execute(
            sa.text(
                "UPDATE matches "
                "SET home_team_placeholder = :home, away_team_placeholder = :away "
                "WHERE fixture_stage = :stage AND status = 'scheduled'",
            ).bindparams(stage=stage, home=home, away=away),
        )


def downgrade() -> None:
    # Placeholder values are fixture data and are intentionally retained.
    pass
