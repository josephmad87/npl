"""Initial schema from SQLAlchemy models.

Revision ID: 20250418_0001
Revises:
Create Date: 2025-04-18

"""

from typing import Sequence, Union

from alembic import op

import app.models  # noqa: F401 — register tables on Base.metadata
from app.db.base import Base

revision: str = "20250418_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
