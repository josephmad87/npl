from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MerchandiseProduct(Base):
    __tablename__ = "merchandise_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_text: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    image_url_2: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    image_url_3: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    sizes_text: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64), default="Other", nullable=False)
    audience: Mapped[str] = mapped_column(String(64), default="Unisex", nullable=False)
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"),
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class MerchandiseProductTeam(Base):
    """A team that a merchandise product is associated with.

    ``MerchandiseProduct.team_id`` remains as the legacy primary assignment so
    existing integrations remain compatible. New product-team assignments are
    stored here, allowing one product to be shown for several teams.
    """

    __tablename__ = "merchandise_product_teams"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("merchandise_products.id", ondelete="CASCADE"),
        primary_key=True,
    )
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )


class MerchandiseOrder(Base):
    __tablename__ = "merchandise_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("merchandise_products.id", ondelete="SET NULL"),
        index=True,
    )
    supporter_id: Mapped[int | None] = mapped_column(
        ForeignKey("supporter_accounts.id", ondelete="SET NULL"), index=True
    )
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("merchandise_product_variants.id", ondelete="SET NULL"), index=True
    )
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    tracking_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    size: Mapped[str | None] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    fulfilment_method: Mapped[str] = mapped_column(String(32), default="collection", nullable=False)
    fulfilment_notes: Mapped[str | None] = mapped_column(Text)
    delivery_address: Mapped[str | None] = mapped_column(Text)
    carrier: Mapped[str | None] = mapped_column(String(128))
    tracking_number: Mapped[str | None] = mapped_column(String(255))
    estimated_ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MerchandiseProductVariant(Base):
    __tablename__ = "merchandise_product_variants"
    __table_args__ = (UniqueConstraint("product_id", "sku", name="uq_merchandise_product_variant_sku"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("merchandise_products.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    size: Mapped[str | None] = mapped_column(String(64))
    colour: Mapped[str | None] = mapped_column(String(64))
    price_text: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    price_minor: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    stock_quantity: Mapped[int | None] = mapped_column(Integer)
    allow_backorder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MerchandiseOrderStatusEvent(Base):
    __tablename__ = "merchandise_order_status_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("merchandise_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    public_message: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
