from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def _encode_token(data: dict[str, Any], expires_delta: timedelta, secret: str) -> str:
    settings = get_settings()
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    to_encode["iat"] = now
    to_encode["exp"] = now + expires_delta
    return jwt.encode(to_encode, secret, algorithm=settings.algorithm)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    claims: dict[str, Any] = {"sub": subject, "type": "access"}
    if extra_claims:
        claims.update(extra_claims)
    return _encode_token(
        claims,
        timedelta(minutes=settings.access_token_expire_minutes),
        settings.secret_key,
    )


def create_refresh_token(subject: str) -> str:
    settings = get_settings()
    return _encode_token(
        {"sub": subject, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
        settings.secret_key,
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def decode_token_safe(token: str) -> dict[str, Any] | None:
    try:
        return decode_token(token)
    except JWTError:
        return None
