"""Associate gallery items with matches.

Revision ID: 20260903_0044
Revises: 20260903_0043
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_0044"
down_revision: str | None = "20260903_0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("gallery_items", sa.Column("match_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_gallery_items_match_id",
        "gallery_items",
        "matches",
        ["match_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_gallery_items_match_id", "gallery_items", ["match_id"])


def downgrade() -> None:
    op.drop_index("ix_gallery_items_match_id", table_name="gallery_items")
    op.drop_constraint("fk_gallery_items_match_id", "gallery_items", type_="foreignkey")
    op.drop_column("gallery_items", "match_id")
