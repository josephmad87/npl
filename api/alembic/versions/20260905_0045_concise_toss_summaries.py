"""Normalize historical toss summaries.

Revision ID: 20260905_0045
Revises: 20260903_0044
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260905_0045"
down_revision: str | None = "20260903_0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Live scoring historically stored both the toss decision and a repeated
    # batting-first sentence. Keep the toss winner and decision only.
    op.execute(
        """
        UPDATE matches
        SET toss_info =
            split_part(toss_info, ' won the toss', 1)
            || ' opt to '
            || CASE
                WHEN lower(toss_info) LIKE '%chose to bat%' THEN 'bat'
                WHEN lower(toss_info) LIKE '%chose to bowl%' THEN 'bowl'
                WHEN lower(toss_info) LIKE '%chose to field%' THEN 'bowl'
            END
        WHERE toss_info IS NOT NULL
          AND toss_info LIKE '% won the toss%'
          AND (
              lower(toss_info) LIKE '%chose to bat%'
              OR lower(toss_info) LIKE '%chose to bowl%'
              OR lower(toss_info) LIKE '%chose to field%'
          )
        """,
    )


def downgrade() -> None:
    # The repeated batting-first sentence cannot be reconstructed reliably.
    pass
