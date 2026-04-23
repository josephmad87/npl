"""Team captain FK, coach/manager headshots, gallery team link.

Revision ID: 20260423_0009
Revises: 20260423_0008
Create Date: 2026-04-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260423_0009"
down_revision: Union[str, None] = "20260423_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("captain_player_id", sa.Integer(), nullable=True))
    op.add_column("teams", sa.Column("coach_image_url", sa.String(length=512), nullable=True))
    op.add_column("teams", sa.Column("manager_image_url", sa.String(length=512), nullable=True))
    op.create_foreign_key(
        "fk_teams_captain_player_id_players",
        "teams",
        "players",
        ["captain_player_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_teams_captain_player_id", "teams", ["captain_player_id"], unique=False)

    op.add_column("gallery_items", sa.Column("team_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_gallery_items_team_id_teams",
        "gallery_items",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_gallery_items_team_id", "gallery_items", ["team_id"], unique=False)

    op.execute(
        """
        UPDATE teams t
        SET captain_player_id = sub.pid
        FROM (
            SELECT t2.id AS tid, MIN(p.id) AS pid
            FROM teams t2
            INNER JOIN players p ON p.team_id = t2.id AND p.full_name = t2.captain
            WHERE t2.captain IS NOT NULL AND trim(t2.captain) <> ''
            GROUP BY t2.id
        ) AS sub
        WHERE t.id = sub.tid
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_gallery_items_team_id_teams", "gallery_items", type_="foreignkey")
    op.drop_index("ix_gallery_items_team_id", table_name="gallery_items")
    op.drop_column("gallery_items", "team_id")

    op.drop_constraint("fk_teams_captain_player_id_players", "teams", type_="foreignkey")
    op.drop_index("ix_teams_captain_player_id", table_name="teams")
    op.drop_column("teams", "manager_image_url")
    op.drop_column("teams", "coach_image_url")
    op.drop_column("teams", "captain_player_id")
