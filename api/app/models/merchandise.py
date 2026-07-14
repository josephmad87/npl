from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
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


class MerchandiseOrder(Base):
    __tablename__ = "merchandise_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("merchandise_products.id", ondelete="SET NULL"),
        index=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    size: Mapped[str | None] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
