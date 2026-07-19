"""Add live scoring assignments and ball events.

Revision ID: 20260717_0020
Revises: 20260717_0019
Create Date: 2026-07-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_0020"
down_revision: Union[str, None] = "20260717_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "match_scorer_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("assigned_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("match_id", "user_id", name="uq_match_scorer_assignments_match_user"),
    )
    op.create_index("ix_match_scorer_assignments_match_id", "match_scorer_assignments", ["match_id"])
    op.create_index("ix_match_scorer_assignments_user_id", "match_scorer_assignments", ["user_id"])
    op.create_index("ix_match_scorer_assignments_assigned_by_user_id", "match_scorer_assignments", ["assigned_by_user_id"])

    op.create_table(
        "match_ball_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("innings", sa.Integer(), nullable=False),
        sa.Column("over_number", sa.Integer(), nullable=False),
        sa.Column("ball_number", sa.Integer(), nullable=False),
        sa.Column("batting_team_id", sa.Integer(), nullable=False),
        sa.Column("bowling_team_id", sa.Integer(), nullable=False),
        sa.Column("striker_player_id", sa.Integer(), nullable=False),
        sa.Column("non_striker_player_id", sa.Integer(), nullable=True),
        sa.Column("bowler_player_id", sa.Integer(), nullable=False),
        sa.Column("runs_batter", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs_extras", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("extras_type", sa.String(length=32), nullable=True),
        sa.Column("is_legal_delivery", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("wicket_type", sa.String(length=64), nullable=True),
        sa.Column("wicket_player_id", sa.Integer(), nullable=True),
        sa.Column("dismissal_text", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["batting_team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["bowling_team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["striker_player_id"], ["players.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["non_striker_player_id"], ["players.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["bowler_player_id"], ["players.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["wicket_player_id"], ["players.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("match_id", "sequence_number", name="uq_match_ball_events_match_sequence"),
    )
    op.create_index("ix_match_ball_events_match_id", "match_ball_events", ["match_id"])
    op.create_index("ix_match_ball_events_innings", "match_ball_events", ["innings"])
    op.create_index("ix_match_ball_events_sequence_number", "match_ball_events", ["sequence_number"])
    op.create_index("ix_match_ball_events_batting_team_id", "match_ball_events", ["batting_team_id"])
    op.create_index("ix_match_ball_events_bowling_team_id", "match_ball_events", ["bowling_team_id"])
    op.create_index("ix_match_ball_events_striker_player_id", "match_ball_events", ["striker_player_id"])
    op.create_index("ix_match_ball_events_non_striker_player_id", "match_ball_events", ["non_striker_player_id"])
    op.create_index("ix_match_ball_events_bowler_player_id", "match_ball_events", ["bowler_player_id"])
    op.create_index("ix_match_ball_events_wicket_player_id", "match_ball_events", ["wicket_player_id"])
    op.create_index("ix_match_ball_events_created_by_user_id", "match_ball_events", ["created_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_match_ball_events_created_by_user_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_wicket_player_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_bowler_player_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_non_striker_player_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_striker_player_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_bowling_team_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_batting_team_id", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_sequence_number", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_innings", table_name="match_ball_events")
    op.drop_index("ix_match_ball_events_match_id", table_name="match_ball_events")
    op.drop_table("match_ball_events")

    op.drop_index("ix_match_scorer_assignments_assigned_by_user_id", table_name="match_scorer_assignments")
    op.drop_index("ix_match_scorer_assignments_user_id", table_name="match_scorer_assignments")
    op.drop_index("ix_match_scorer_assignments_match_id", table_name="match_scorer_assignments")
    op.drop_table("match_scorer_assignments")
