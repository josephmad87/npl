"""Expand team profile fields for public/team hubs.

Revision ID: 20260423_0007
Revises: 20260423_0006
Create Date: 2026-04-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260423_0007"
down_revision: Union[str, None] = "20260423_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("teams") as batch_op:
        batch_op.add_column(sa.Column("home_ground_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("home_ground_location", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("home_ground_image_url", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("manager", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("history", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("trophies", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("team_photo_urls", sa.JSON(), nullable=True))

    op.execute(
        """
        UPDATE teams
        SET home_ground_name = home_ground
        WHERE home_ground IS NOT NULL AND trim(home_ground) <> ''
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("teams") as batch_op:
        batch_op.drop_column("team_photo_urls")
        batch_op.drop_column("trophies")
        batch_op.drop_column("history")
        batch_op.drop_column("manager")
        batch_op.drop_column("home_ground_image_url")
        batch_op.drop_column("home_ground_location")
        batch_op.drop_column("home_ground_name")
