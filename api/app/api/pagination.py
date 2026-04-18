from math import ceil
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def paginate_select(
    db: Session,
    stmt: Select[Any],
    *,
    count_stmt: Select[Any] | None = None,
    page: int,
    page_size: int,
) -> tuple[list[Any], int]:
    if count_stmt is None:
        count_stmt = select(func.count()).select_from(stmt.subquery())
    total_raw = db.scalar(count_stmt)
    total = int(total_raw) if total_raw is not None else 0
    offset = (page - 1) * page_size
    rows = list(db.scalars(stmt.offset(offset).limit(page_size)).all())
    return rows, total


def to_paginated(items: list[T], total: int, page: int, page_size: int) -> PaginatedResponse[T]:
    pages = ceil(total / page_size) if page_size else 0
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)
