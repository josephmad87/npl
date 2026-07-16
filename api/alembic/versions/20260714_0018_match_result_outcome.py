"""Add outcome to match results.

Revision ID: 20260714_0018
Revises: 20260714_0017
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260714_0018"
down_revision: Union[str, None] = "20260714_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "match_results",
        sa.Column(
            "outcome",
            sa.String(length=32),
            nullable=False,
            server_default="win",
        ),
    )

    op.create_index(
        "ix_match_results_outcome",
        "match_results",
        ["outcome"],
    )

    op.execute(
        """
        UPDATE match_results
        SET outcome = 'tie'
        WHERE winning_team_id IS NULL
          AND (
            lower(coalesce(margin_text, '')) LIKE '%tie%'
            OR lower(coalesce(margin_text, '')) LIKE '%tied%'
            OR lower(coalesce(score_summary, '')) LIKE '%tie%'
            OR lower(coalesce(score_summary, '')) LIKE '%tied%'
            OR lower(coalesce(innings_breakdown, '')) LIKE '%tie%'
            OR lower(coalesce(innings_breakdown, '')) LIKE '%tied%'
          )
        """
    )

    op.execute(
        """
        UPDATE match_results
        SET outcome = 'no_result'
        WHERE winning_team_id IS NULL
          AND outcome = 'win'
          AND (
            lower(coalesce(margin_text, '')) LIKE '%no result%'
            OR lower(coalesce(margin_text, '')) LIKE '%abandoned%'
            OR lower(coalesce(margin_text, '')) LIKE '%washed out%'
            OR lower(coalesce(score_summary, '')) LIKE '%no result%'
            OR lower(coalesce(score_summary, '')) LIKE '%abandoned%'
            OR lower(coalesce(score_summary, '')) LIKE '%washed out%'
            OR lower(coalesce(innings_breakdown, '')) LIKE '%no result%'
            OR lower(coalesce(innings_breakdown, '')) LIKE '%abandoned%'
            OR lower(coalesce(innings_breakdown, '')) LIKE '%washed out%'
          )
        """
    )

    op.execute(
        """
        UPDATE match_results
        SET outcome = 'no_result'
        WHERE winning_team_id IS NULL
          AND outcome = 'win'
        """
    )


def downgrade() -> None:
    op.drop_index("ix_match_results_outcome", table_name="match_results")
    op.drop_column("match_results", "outcome")
