from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SeoRedirect(Base):
    """Permanent redirect retained when a public slug or route changes."""

    __tablename__ = "seo_redirects"
    __table_args__ = (
        CheckConstraint("status_code = 301", name="seo_redirect_status_permanent"),
        CheckConstraint(
            "source_path LIKE '/%' AND source_path NOT LIKE '//%'",
            name="seo_redirect_source_local",
        ),
        CheckConstraint(
            "target_path LIKE '/%' AND target_path NOT LIKE '//%'",
            name="seo_redirect_target_local",
        ),
        UniqueConstraint("source_path"),
        Index("ix_seo_redirects_source_path", "source_path", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    target_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    status_code: Mapped[int] = mapped_column(
        Integer,
        default=301,
        server_default="301",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        index=True,
        nullable=False,
    )
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
