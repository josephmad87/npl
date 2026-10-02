from typing import Annotated, Literal

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

# Loose email shape so internal / dev domains (e.g. .test) are accepted; DB still enforces uniqueness.
EmailLike = Annotated[str, Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+$")]


class LoginRequest(BaseModel):
    email: EmailLike
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MfaRequiredLoginResponse(BaseModel):
    status: Literal["mfa_required"] = "mfa_required"
    challenge_token: str


class MfaEnrollmentRequiredLoginResponse(BaseModel):
    status: Literal["mfa_enrollment_required"] = "mfa_enrollment_required"
    challenge_token: str


LoginResponse = MfaRequiredLoginResponse | MfaEnrollmentRequiredLoginResponse


class MfaChallengeRequest(BaseModel):
    challenge_token: str = Field(min_length=10, max_length=4096)


class MfaVerificationRequest(MfaChallengeRequest):
    code: str = Field(min_length=6, max_length=64)


class MfaEnrollmentOut(BaseModel):
    secret: str
    otpauth_uri: str
    qr_data_uri: str


class MfaEnrollmentConfirmOut(BaseModel):
    tokens: TokenResponse
    recovery_codes: list[str]


class UserMe(ORMModel):
    id: int
    email: str
    full_name: str | None
    role: str
    is_active: bool
    mfa_enabled: bool
    created_at: datetime


class UserMeUpdate(BaseModel):
    """Self-service profile patch for the authenticated user."""

    full_name: str | None = Field(None, max_length=255)
    current_password: str | None = Field(None, min_length=1)
    new_password: str | None = Field(None, min_length=12, max_length=128)


class AdminUserCreate(BaseModel):
    email: EmailLike
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = None
    role: str = Field(
        pattern="^(super_admin|competition_manager|content_editor|read_only_admin|scorer|commentator)$",
    )


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(
        default=None,
        pattern="^(super_admin|competition_manager|content_editor|read_only_admin|scorer|commentator)$",
    )
    is_active: bool | None = None
