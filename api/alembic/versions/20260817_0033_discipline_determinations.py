"""Add discipline cases, sanctions and NRR-safe administrative awards.

Revision ID: 20260817_0033
Revises: 20260817_0032
Create Date: 2026-08-17
"""

import sqlalchemy as sa
from alembic import op


revision = "20260817_0033"
down_revision = "20260817_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_results",
        sa.Column("nrr_excluded", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "discipline_cases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("subject_team_id", sa.Integer(), nullable=True),
        sa.Column("subject_player_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("confidentiality", sa.String(length=32), nullable=False, server_default="restricted"),
        sa.Column("summary", sa.String(length=512), nullable=False),
        sa.Column("evidence_notes", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reported_by_user_id", sa.Integer(), nullable=True),
        sa.Column("decision_text", sa.Text(), nullable=True),
        sa.Column("public_summary", sa.String(length=512), nullable=True),
        sa.Column("appeal_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subject_team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subject_player_id"], ["players.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reported_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decided_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_discipline_cases_match_id", ["match_id"]),
        ("ix_discipline_cases_subject_team_id", ["subject_team_id"]),
        ("ix_discipline_cases_subject_player_id", ["subject_player_id"]),
        ("ix_discipline_cases_category", ["category"]),
        ("ix_discipline_cases_status", ["status"]),
        ("ix_discipline_cases_confidentiality", ["confidentiality"]),
    ):
        op.create_index(name, "discipline_cases", columns, unique=False)
    op.create_table(
        "discipline_sanctions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("sanction_type", sa.String(length=48), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("player_id", sa.Integer(), nullable=True),
        sa.Column("points_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fine_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("match_count", sa.Integer(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("notes", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["discipline_cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_discipline_sanctions_case_id", ["case_id"]),
        ("ix_discipline_sanctions_sanction_type", ["sanction_type"]),
        ("ix_discipline_sanctions_team_id", ["team_id"]),
        ("ix_discipline_sanctions_player_id", ["player_id"]),
        ("ix_discipline_sanctions_status", ["status"]),
    ):
        op.create_index(name, "discipline_sanctions", columns, unique=False)


def downgrade() -> None:
    op.drop_table("discipline_sanctions")
    op.drop_table("discipline_cases")
    op.drop_column("match_results", "nrr_excluded")
