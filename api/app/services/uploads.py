"""Persist uploaded binaries under `media_root` and serve them via the `/api/v1/media/...` static mount."""

from __future__ import annotations

import mimetypes
from urllib import error as urlerror
from urllib import request as urlrequest
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import Settings

ALLOWED_KINDS = frozenset({"leagues", "teams", "players", "gallery", "news", "matches", "misc"})

IMAGE_EXTENSIONS = frozenset(
    {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp", ".tif", ".tiff", ".heic", ".heif"},
)
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".mpeg", ".mpg", ".ogv"})

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_BYTES = 120 * 1024 * 1024


def _resolved_media_root(settings: Settings) -> Path:
    root = Path(settings.media_root)
    if not root.is_absolute():
        root = Path.cwd() / root
    return root


def _is_supabase_enabled(settings: Settings) -> bool:
    return bool(
        (settings.supabase_url or "").strip()
        and (settings.supabase_service_role_key or "").strip()
        and (settings.supabase_storage_bucket or "").strip(),
    )


def _supabase_object_key(settings: Settings, *, kind: str, filename: str) -> str:
    prefix = (settings.supabase_storage_prefix or "").strip().strip("/")
    if prefix:
        return f"{prefix}/{kind}/{filename}"
    return f"{kind}/{filename}"


def _upload_to_supabase(
    settings: Settings,
    *,
    object_key: str,
    raw: bytes,
    content_type: str | None,
) -> None:
    base = (settings.supabase_url or "").strip().rstrip("/")
    bucket = (settings.supabase_storage_bucket or "").strip()
    token = (settings.supabase_service_role_key or "").strip()
    endpoint = f"{base}/storage/v1/object/{bucket}/{object_key}"
    req = urlrequest.Request(
        endpoint,
        data=raw,
        method="POST",
        headers={
            "apikey": token,
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "false",
        },
    )
    try:
        with urlrequest.urlopen(req):
            return
    except urlerror.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "storage_error",
                "message": "Failed to upload file to Supabase Storage",
                "provider_status": exc.code,
                "provider_response": detail or None,
            },
        ) from exc
    except urlerror.URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "storage_error",
                "message": f"Could not reach Supabase Storage: {exc.reason}",
            },
        ) from exc


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
    if guessed == "image/avif":
        return ".avif"
    if guessed == "image/svg+xml":
        return ".svg"
    if guessed == "image/bmp":
        return ".bmp"
    if guessed == "image/tiff":
        return ".tiff"
    if guessed in {"image/heic", "image/heif"}:
        return ".heic" if guessed == "image/heic" else ".heif"
    if guessed == "video/mp4":
        return ".mp4"
    if guessed == "video/webm":
        return ".webm"
    if guessed == "video/quicktime":
        return ".mov"
    if guessed == "video/x-m4v":
        return ".m4v"
    if guessed == "video/x-msvideo":
        return ".avi"
    if guessed in {"video/x-matroska", "video/webm;codecs=vp9"}:
        return ".mkv"
    if guessed == "video/mpeg":
        return ".mpeg"
    if guessed == "video/ogg":
        return ".ogv"
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
        if ct == "image/avif":
            return ".avif"
        if ct == "image/svg+xml":
            return ".svg"
        if ct == "image/bmp":
            return ".bmp"
        if ct == "image/tiff":
            return ".tiff"
        if ct in {"image/heic", "image/heif"}:
            return ".heic" if ct == "image/heic" else ".heif"
        if ct == "video/mp4":
            return ".mp4"
        if ct == "video/webm":
            return ".webm"
        if ct == "video/quicktime":
            return ".mov"
        if ct == "video/x-m4v":
            return ".m4v"
        if ct == "video/x-msvideo":
            return ".avi"
        if ct == "video/x-matroska":
            return ".mkv"
        if ct == "video/mpeg":
            return ".mpeg"
        if ct == "video/ogg":
            return ".ogv"
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
    if _is_supabase_enabled(settings):
        storage_key = _supabase_object_key(settings, kind=kind, filename=name)
        _upload_to_supabase(
            settings,
            object_key=storage_key,
            raw=raw,
            content_type=file.content_type,
        )
        return storage_key

    storage_key = f"files/{kind}/{name}"
    dest = _resolved_media_root(settings) / storage_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    return storage_key


def build_media_public_url(settings: Settings, request_base_url: str, storage_key: str) -> str:
    """Absolute browser URL for a stored object (``storage_key`` as returned by ``save_upload_file``)."""
    if _is_supabase_enabled(settings):
        base = (settings.supabase_url or "").strip().rstrip("/")
        bucket = (settings.supabase_storage_bucket or "").strip()
        return f"{base}/storage/v1/object/public/{bucket}/{storage_key}"
    path = f"{settings.api_v1_prefix}/media/{storage_key}"
    if settings.public_base_url:
        return f"{settings.public_base_url.rstrip('/')}{path}"
    return f"{request_base_url.rstrip('/')}{path}"
