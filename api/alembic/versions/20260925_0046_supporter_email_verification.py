"""Add a phone contact field for supporter accounts.

Revision ID: 20260925_0046
Revises: 20260905_0045
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260925_0046"
down_revision: str | None = "20260905_0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("supporter_accounts", sa.Column("phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("supporter_accounts", "phone")
