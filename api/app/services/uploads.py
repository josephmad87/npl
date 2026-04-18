"""Persist uploaded binaries under `media_root` and serve them via the `/api/v1/media/...` static mount."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import Settings

ALLOWED_KINDS = frozenset({"leagues", "teams", "players", "gallery", "news", "matches", "misc"})

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm", ".mov"})

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_BYTES = 120 * 1024 * 1024


def _resolved_media_root(settings: Settings) -> Path:
    root = Path(settings.media_root)
    if not root.is_absolute():
        root = Path.cwd() / root
    return root


def _extension_from_upload(filename: str | None, content_type: str | None) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS:
        return ext
    guessed, _ = mimetypes.guess_type(filename or "")
    if guessed == "image/jpeg":
        return ".jpg"
    if guessed == "image/png":
        return ".png"
    if guessed == "image/webp":
        return ".webp"
    if guessed == "image/gif":
        return ".gif"
    if guessed == "video/mp4":
        return ".mp4"
    if guessed == "video/webm":
        return ".webm"
    if guessed == "video/quicktime":
        return ".mov"
    if content_type:
        ct = content_type.split(";")[0].strip().lower()
        if ct == "image/jpeg":
            return ".jpg"
        if ct == "image/png":
            return ".png"
        if ct == "image/webp":
            return ".webp"
        if ct == "image/gif":
            return ".gif"
        if ct == "video/mp4":
            return ".mp4"
        if ct == "video/webm":
            return ".webm"
        if ct == "video/quicktime":
            return ".mov"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "validation", "message": "Unsupported or missing file extension"},
    )


def _max_bytes_for(kind: str, ext: str) -> int:
    if ext in VIDEO_EXTENSIONS:
        if kind != "gallery":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "validation", "message": "Video uploads are only allowed for gallery"},
            )
        return MAX_VIDEO_BYTES
    if ext in IMAGE_EXTENSIONS:
        return MAX_IMAGE_BYTES
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "validation", "message": "Unsupported file type"},
    )


def _allowed_extensions_for_kind(kind: str) -> frozenset[str]:
    if kind == "gallery":
        return IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
    return IMAGE_EXTENSIONS


def save_upload_file(settings: Settings, *, kind: str, file: UploadFile) -> str:
    """
    Persist the file and return the storage key relative to the static mount root,
    e.g. ``files/leagues/uuid.jpg``.
    """
    if kind not in ALLOWED_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": f"Invalid kind; use one of: {', '.join(sorted(ALLOWED_KINDS))}"},
        )
    ext = _extension_from_upload(file.filename, file.content_type)
    allowed = _allowed_extensions_for_kind(kind)
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": "This upload category does not allow that file type"},
        )
    max_bytes = _max_bytes_for(kind, ext)
    raw = file.file.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "payload_too_large", "message": "File is too large"},
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": "Empty file"},
        )

    name = f"{uuid4().hex}{ext}"
    storage_key = f"files/{kind}/{name}"
    dest = _resolved_media_root(settings) / storage_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    return storage_key


def build_media_public_url(settings: Settings, request_base_url: str, storage_key: str) -> str:
    """Absolute browser URL for a stored object (``storage_key`` as returned by ``save_upload_file``)."""
    path = f"{settings.api_v1_prefix}/media/{storage_key}"
    if settings.public_base_url:
        return f"{settings.public_base_url.rstrip('/')}{path}"
    return f"{request_base_url.rstrip('/')}{path}"
