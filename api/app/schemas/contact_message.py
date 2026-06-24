from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ContactMessageCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=5000)
    website: str | None = Field(default=None, max_length=255, description="Honeypot field; must be empty")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip()
        if "@" not in trimmed or trimmed.startswith("@") or trimmed.endswith("@"):
            raise ValueError("Invalid email address")
        return trimmed

    @field_validator("website")
    @classmethod
    def honeypot_empty(cls, v: str | None) -> str | None:
        if v and v.strip():
            raise ValueError("Invalid submission")
        return v


class ContactMessageUpdate(BaseModel):
    read: bool | None = None


class ContactMessageOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    message: str
    created_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}
