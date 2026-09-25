"""Require verified supporter emails and retain supporter contact details.

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
    op.create_table(
        "supporter_email_verifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_supporter_email_verifications_supporter_id",
        "supporter_email_verifications",
        ["supporter_id"],
    )
    op.create_index(
        "ix_supporter_email_verifications_token_hash",
        "supporter_email_verifications",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_supporter_email_verifications_expires_at",
        "supporter_email_verifications",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_supporter_email_verifications_expires_at", table_name="supporter_email_verifications")
    op.drop_index("ix_supporter_email_verifications_token_hash", table_name="supporter_email_verifications")
    op.drop_index("ix_supporter_email_verifications_supporter_id", table_name="supporter_email_verifications")
    op.drop_table("supporter_email_verifications")
    op.drop_column("supporter_accounts", "phone")
