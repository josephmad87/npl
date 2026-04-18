from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ArticleBase(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    slug: str = Field(min_length=1, max_length=512)
    excerpt: str | None = None
    body: str | None = None
    featured_image_url: str | None = None
    author_name: str | None = None
    status: str = "draft"
    category: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    published_at: datetime | None = None
    related_entities: dict | None = None


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    slug: str | None = Field(default=None, min_length=1, max_length=512)
    excerpt: str | None = None
    body: str | None = None
    featured_image_url: str | None = None
    author_name: str | None = None
    status: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    published_at: datetime | None = None
    related_entities: dict | None = None


class ArticleOut(ORMModel):
    id: int
    title: str
    slug: str
    excerpt: str | None
    body: str | None
    featured_image_url: str | None
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
