"""Align operational indexes required by the current models.

Revision ID: 20260902_0038
Revises: 20260901_0037
Create Date: 2026-09-02
"""

from alembic import op

revision = "20260902_0038"
down_revision = "20260901_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_discipline_cases_reported_by_user_id",
        "discipline_cases",
        ["reported_by_user_id"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        "ix_discipline_cases_decided_by_user_id",
        "discipline_cases",
        ["decided_by_user_id"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_discipline_cases_decided_by_user_id",
        table_name="discipline_cases",
        if_exists=True,
    )
    op.drop_index(
        "ix_discipline_cases_reported_by_user_id",
        table_name="discipline_cases",
        if_exists=True,
    )
