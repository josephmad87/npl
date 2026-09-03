"""Add explicit scorer and commentator duties per match.

Revision ID: 20260903_0043
Revises: 20260903_0042
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_0043"
down_revision: str | None = "20260903_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "match_scorer_assignments",
        sa.Column(
            "duty",
            sa.String(length=32),
            nullable=False,
            server_default="score_and_commentary",
        ),
    )
    op.execute(
        """
        UPDATE match_scorer_assignments
        SET duty = 'commentator_only'
        WHERE user_id IN (SELECT id FROM users WHERE role = 'commentator')
        """
    )
    op.execute(
        """
        UPDATE match_scorer_assignments
        SET duty = 'scorer_only'
        WHERE user_id IN (SELECT id FROM users WHERE role = 'scorer')
          AND match_id IN (
              SELECT assignment.match_id
              FROM match_scorer_assignments AS assignment
              JOIN users ON users.id = assignment.user_id
              WHERE users.role = 'commentator'
          )
        """
    )
    op.create_index(
        "ix_match_scorer_assignments_duty",
        "match_scorer_assignments",
        ["duty"],
    )
    op.alter_column(
        "match_scorer_assignments",
        "duty",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_match_scorer_assignments_duty",
        table_name="match_scorer_assignments",
    )
    op.drop_column("match_scorer_assignments", "duty")
