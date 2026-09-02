"""Add supporter engagement, push outbox, secure voting and commerce fulfilment.

Revision ID: 20260903_0041
Revises: 20260903_0040
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_0041"
down_revision: str | None = "20260903_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def upgrade() -> None:
    created_at, updated_at = _timestamps()
    op.create_table(
        "supporter_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("policy_version", sa.String(length=32), nullable=False),
        sa.Column("marketing_consent", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("push_consent", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("analytics_consent", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("consent_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_supporter_accounts_email", "supporter_accounts", ["email"], unique=True)
    op.create_index("ix_supporter_accounts_is_active", "supporter_accounts", ["is_active"])

    op.create_table(
        "supporter_consent_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("consent_type", sa.String(length=32), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("policy_version", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="website", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_supporter_consent_events_supporter_id", "supporter_consent_events", ["supporter_id"])
    op.create_index("ix_supporter_consent_events_consent_type", "supporter_consent_events", ["consent_type"])
    op.create_index("ix_supporter_consent_events_occurred_at", "supporter_consent_events", ["occurred_at"])

    op.create_table(
        "supporter_team_follows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("supporter_id", "team_id", name="uq_supporter_team_follow"),
    )
    op.create_index("ix_supporter_team_follows_supporter_id", "supporter_team_follows", ["supporter_id"])
    op.create_index("ix_supporter_team_follows_team_id", "supporter_team_follows", ["team_id"])

    op.create_table(
        "supporter_player_follows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("supporter_id", "player_id", name="uq_supporter_player_follow"),
    )
    op.create_index("ix_supporter_player_follows_supporter_id", "supporter_player_follows", ["supporter_id"])
    op.create_index("ix_supporter_player_follows_player_id", "supporter_player_follows", ["player_id"])

    op.create_table(
        "fan_push_devices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column("device_token", sa.Text(), nullable=False),
        sa.Column("device_token_hash", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fan_push_devices_supporter_id", "fan_push_devices", ["supporter_id"])
    op.create_index("ix_fan_push_devices_device_token_hash", "fan_push_devices", ["device_token_hash"], unique=True)
    op.create_index("ix_fan_push_devices_enabled", "fan_push_devices", ["enabled"])

    op.create_table(
        "fan_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("supporter_id", "match_id", "event_type", "scheduled_for", "status", "idempotency_key"):
        op.create_index(f"ix_fan_notifications_{column}", "fan_notifications", [column], unique=column == "idempotency_key")

    op.create_table(
        "fan_engagement_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supporter_id", sa.Integer(), nullable=True),
        sa.Column("anonymous_id_hash", sa.String(length=64), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=32), server_default="website", nullable=False),
        sa.Column("properties", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supporter_id"], ["supporter_accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("supporter_id", "anonymous_id_hash", "event_type", "entity_type", "entity_id", "occurred_at"):
        op.create_index(f"ix_fan_engagement_events_{column}", "fan_engagement_events", [column])

    op.add_column("fan_player_match_votes", sa.Column("supporter_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_fan_player_match_votes_supporter",
        "fan_player_match_votes",
        "supporter_accounts",
        ["supporter_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_fan_player_match_votes_supporter_id", "fan_player_match_votes", ["supporter_id"])
    op.create_unique_constraint(
        "uq_fan_player_match_votes_match_supporter",
        "fan_player_match_votes",
        ["match_id", "supporter_id"],
    )

    op.create_table(
        "merchandise_product_variants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("size", sa.String(length=64), nullable=True),
        sa.Column("colour", sa.String(length=64), nullable=True),
        sa.Column("price_text", sa.String(length=64), server_default="", nullable=False),
        sa.Column("price_minor", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("stock_quantity", sa.Integer(), nullable=True),
        sa.Column("allow_backorder", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["merchandise_products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "sku", name="uq_merchandise_product_variant_sku"),
        sa.CheckConstraint("price_minor IS NULL OR price_minor >= 0", name="merch_variant_price_nonnegative"),
        sa.CheckConstraint("stock_quantity IS NULL OR stock_quantity >= 0", name="merch_variant_stock_nonnegative"),
    )
    op.create_index("ix_merchandise_product_variants_product_id", "merchandise_product_variants", ["product_id"])
    op.create_index("ix_merchandise_product_variants_sku", "merchandise_product_variants", ["sku"])
    op.create_index("ix_merchandise_product_variants_status", "merchandise_product_variants", ["status"])

    op.add_column("merchandise_orders", sa.Column("supporter_id", sa.Integer(), nullable=True))
    op.add_column("merchandise_orders", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.add_column("merchandise_orders", sa.Column("order_number", sa.String(length=32), nullable=True))
    op.add_column("merchandise_orders", sa.Column("tracking_token_hash", sa.String(length=64), nullable=True))
    op.add_column("merchandise_orders", sa.Column("payment_status", sa.String(length=32), server_default="pending", nullable=False))
    op.add_column("merchandise_orders", sa.Column("fulfilment_method", sa.String(length=32), server_default="collection", nullable=False))
    op.add_column("merchandise_orders", sa.Column("fulfilment_notes", sa.Text(), nullable=True))
    op.add_column("merchandise_orders", sa.Column("delivery_address", sa.Text(), nullable=True))
    op.add_column("merchandise_orders", sa.Column("carrier", sa.String(length=128), nullable=True))
    op.add_column("merchandise_orders", sa.Column("tracking_number", sa.String(length=255), nullable=True))
    op.add_column("merchandise_orders", sa.Column("estimated_ready_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "merchandise_orders",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute(
        "UPDATE merchandise_orders SET "
        "order_number = 'NPL-' || LPAD(id::text, 8, '0'), "
        "tracking_token_hash = MD5('legacy-order-' || id::text)"
    )
    op.alter_column("merchandise_orders", "order_number", nullable=False)
    op.alter_column("merchandise_orders", "tracking_token_hash", nullable=False)
    op.create_foreign_key(
        "fk_merchandise_orders_supporter", "merchandise_orders", "supporter_accounts", ["supporter_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_merchandise_orders_variant", "merchandise_orders", "merchandise_product_variants", ["variant_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_merchandise_orders_supporter_id", "merchandise_orders", ["supporter_id"])
    op.create_index("ix_merchandise_orders_variant_id", "merchandise_orders", ["variant_id"])
    op.create_index("ix_merchandise_orders_order_number", "merchandise_orders", ["order_number"], unique=True)

    op.create_table(
        "merchandise_order_status_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("public_message", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["merchandise_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_merchandise_order_status_events_order_id", "merchandise_order_status_events", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_merchandise_order_status_events_order_id", table_name="merchandise_order_status_events")
    op.drop_table("merchandise_order_status_events")
    for index_name in (
        "ix_merchandise_orders_order_number",
        "ix_merchandise_orders_variant_id",
        "ix_merchandise_orders_supporter_id",
    ):
        op.drop_index(index_name, table_name="merchandise_orders")
    op.drop_constraint("fk_merchandise_orders_variant", "merchandise_orders", type_="foreignkey")
    op.drop_constraint("fk_merchandise_orders_supporter", "merchandise_orders", type_="foreignkey")
    for column in (
        "updated_at", "estimated_ready_at", "tracking_number", "carrier", "delivery_address",
        "fulfilment_notes", "fulfilment_method", "payment_status", "tracking_token_hash",
        "order_number", "variant_id", "supporter_id",
    ):
        op.drop_column("merchandise_orders", column)
    op.drop_index("ix_merchandise_product_variants_status", table_name="merchandise_product_variants")
    op.drop_index("ix_merchandise_product_variants_sku", table_name="merchandise_product_variants")
    op.drop_index("ix_merchandise_product_variants_product_id", table_name="merchandise_product_variants")
    op.drop_table("merchandise_product_variants")
    op.drop_constraint("uq_fan_player_match_votes_match_supporter", "fan_player_match_votes", type_="unique")
    op.drop_index("ix_fan_player_match_votes_supporter_id", table_name="fan_player_match_votes")
    op.drop_constraint("fk_fan_player_match_votes_supporter", "fan_player_match_votes", type_="foreignkey")
    op.drop_column("fan_player_match_votes", "supporter_id")
    for table_name in (
        "fan_engagement_events", "fan_notifications", "fan_push_devices",
        "supporter_player_follows", "supporter_team_follows",
        "supporter_consent_events", "supporter_accounts",
    ):
        op.drop_table(table_name)
