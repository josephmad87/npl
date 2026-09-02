from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel
from app.services.html_sanitizer import sanitize_rich_html

CompetitionArticleCategory = Literal["mens", "women", "youth"]


class ArticleBase(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    slug: str = Field(
        min_length=1,
        max_length=512,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    excerpt: str | None = None
    body: str | None = None
    featured_image_url: str | None = None
    body_image_url: str | None = None
    author_name: str | None = None
    status: str = "draft"
    category: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    published_at: datetime | None = None
    related_entities: dict | None = None

    @field_validator("body")
    @classmethod
    def sanitise_body(cls, value: str | None) -> str | None:
        return sanitize_rich_html(value) if value is not None else None


class ArticleCreate(ArticleBase):
    category: CompetitionArticleCategory = "mens"


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    slug: str | None = Field(
        default=None,
        min_length=1,
        max_length=512,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    excerpt: str | None = None
    body: str | None = None
    featured_image_url: str | None = None
    body_image_url: str | None = None
    author_name: str | None = None
    status: str | None = None
    category: CompetitionArticleCategory | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    published_at: datetime | None = None
    related_entities: dict | None = None

    @field_validator("body")
    @classmethod
    def sanitise_body(cls, value: str | None) -> str | None:
        return sanitize_rich_html(value) if value is not None else None


class ArticleOut(ORMModel):
    id: int
    title: str
    slug: str
    excerpt: str | None
    body: str | None
    featured_image_url: str | None
    body_image_url: str | None
    author_name: str | None
    status: str
    category: str | None
    tags: list[str] | None
    seo_title: str | None
    seo_description: str | None
    published_at: datetime | None
    related_entities: dict | None
    created_at: datetime
    updated_at: datetime

    @field_validator("body")
    @classmethod
    def sanitise_body(cls, value: str | None) -> str | None:
        return sanitize_rich_html(value) if value is not None else None
