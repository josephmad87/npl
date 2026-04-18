from typing import Annotated

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

# Loose email shape so internal / dev domains (e.g. .test) are accepted; DB still enforces uniqueness.
EmailLike = Annotated[str, Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+$")]


class LoginRequest(BaseModel):
    email: EmailLike
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserMe(ORMModel):
    id: int
    email: str
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime


class UserMeUpdate(BaseModel):
    """Self-service profile patch for the authenticated user."""

    full_name: str | None = Field(None, max_length=255)
    current_password: str | None = Field(None, min_length=1)
    new_password: str | None = Field(None, min_length=8, max_length=128)


class AdminUserCreate(BaseModel):
    email: EmailLike
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: str = Field(
        pattern="^(super_admin|competition_manager|content_editor|read_only_admin)$",
    )
