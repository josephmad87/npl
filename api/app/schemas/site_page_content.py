from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.html_sanitizer import sanitize_rich_html


SitePageSlug = Literal[
    "privacy",
    "terms",
    "support",
    "account-deletion",
    "competition",
    "safeguarding",
    "scorecard-corrections",
    "supporters",
]


class SitePageSection(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    heading: str = Field(min_length=1, max_length=200)
    body_html: str = Field(default="", max_length=30_000)

    @field_validator("body_html")
    @classmethod
    def sanitise_body_html(cls, value: str) -> str:
        return sanitize_rich_html(value)


class SitePageBody(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    subtitle: str = Field(default="", max_length=500)
    effective_date: str = Field(default="", max_length=80)
    intro_html: str = Field(default="", max_length=30_000)
    sections: list[SitePageSection] = Field(default_factory=list, max_length=30)

    @field_validator("intro_html")
    @classmethod
    def sanitise_intro_html(cls, value: str) -> str:
        return sanitize_rich_html(value)

    @model_validator(mode="after")
    def section_ids_are_unique(self) -> "SitePageBody":
        ids = [section.id for section in self.sections]
        if len(ids) != len(set(ids)):
            raise ValueError("Section IDs must be unique")
        return self


class SitePageOut(SitePageBody):
    slug: SitePageSlug
    updated_at: datetime
