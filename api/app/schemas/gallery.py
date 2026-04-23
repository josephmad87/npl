from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class GalleryItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=255)
    description: str | None = None
    media_type: str = Field(min_length=1, max_length=16)
    file_url: str = Field(min_length=1, max_length=1024)
    thumbnail_url: str | None = None
    status: str = "draft"
    tags: list[str] | None = None
    related_entities: dict | None = None
    team_id: int | None = None


class GalleryItemCreate(GalleryItemBase):
    pass


class GalleryItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = None
    description: str | None = None
    media_type: str | None = None
    file_url: str | None = None
    thumbnail_url: str | None = None
    status: str | None = None
    tags: list[str] | None = None
    related_entities: dict | None = None
    team_id: int | None = None


class GalleryItemOut(ORMModel):
    id: int
    title: str
    slug: str | None
    description: str | None
    media_type: str
    file_url: str
    thumbnail_url: str | None
    uploaded_by_user_id: int | None
    status: str
    tags: list[str] | None
    related_entities: dict | None
    team_id: int | None
    created_at: datetime
