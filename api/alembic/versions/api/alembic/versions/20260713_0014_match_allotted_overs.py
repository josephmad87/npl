"""Add allotted overs to match results.

Revision ID: 20260713_0014
Revises: 20260713_0013
Create Date: 2026-07-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260713_0014"
down_revision: Union[str, None] = "20260713_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_results",
        sa.Column(
            "home_allotted_overs",
            sa.Numeric(6, 2),
            nullable=False,
            server_default="40.0",
        ),
    )
    op.add_column(
        "match_results",
        sa.Column(
            "away_allotted_overs",
            sa.Numeric(6, 2),
            nullable=False,
            server_default="40.0",
        ),
    )

    # Existing T20 results should default to 20 overs.
    op.execute(
        """
        UPDATE match_results AS mr
        SET
            home_allotted_overs = 20.0,
            away_allotted_overs = 20.0
        FROM matches AS m
        LEFT JOIN seasons AS s ON s.id = m.season_id
        LEFT JOIN leagues AS l ON l.id = s.league_id
        WHERE mr.match_id = m.id
          AND (
            lower(coalesce(l.slug, '')) LIKE '%t20%'
            OR lower(coalesce(l.name, '')) LIKE '%t20%'
            OR lower(coalesce(s.slug, '')) LIKE '%t20%'
            OR lower(coalesce(s.name, '')) LIKE '%t20%'
            OR lower(coalesce(m.title, '')) LIKE '%t20%'
          )
        """
    )


def downgrade() -> None:
    op.drop_column("match_results", "away_allotted_overs")
    op.drop_column("match_results", "home_allotted_overs")
