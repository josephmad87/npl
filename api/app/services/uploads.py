"""Persist uploaded binaries under `media_root` and serve them via the `/api/v1/media/...` static mount."""

from __future__ import annotations

from io import BytesIO
from urllib import error as urlerror
from urllib import request as urlrequest
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import Settings

ALLOWED_KINDS = frozenset({
    "leagues",
    "teams",
    "players",
    "gallery",
    "news",
    "matches",
    "merchandise",
    "misc",
})

IMAGE_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "GIF": (".gif", "image/gif"),
    "WEBP": (".webp", "image/webp"),
}
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".ogv"})

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_BYTES = 120 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_DIMENSION = 12_000


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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "storage_error",
                "message": "Failed to upload file to Supabase Storage",
                "provider_status": exc.code,
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


def _detect_image(raw: bytes) -> tuple[str, str] | None:
    try:
        with Image.open(BytesIO(raw)) as image:
            image_format = (image.format or "").upper()
            width, height = image.size
            if image_format not in IMAGE_FORMATS:
                return None
            if width <= 0 or height <= 0 or max(width, height) > MAX_IMAGE_DIMENSION:
                raise ValueError("Image dimensions are not allowed")
            if width * height > MAX_IMAGE_PIXELS:
                raise ValueError("Image contains too many pixels")
            image.verify()
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        return None
    return IMAGE_FORMATS[image_format]


def _detect_video(raw: bytes) -> tuple[str, str] | None:
    prefix = raw[:256]
    if len(prefix) >= 12 and prefix[4:8] == b"ftyp":
        if prefix[8:12] == b"qt  ":
            return ".mov", "video/quicktime"
        return ".mp4", "video/mp4"
    if prefix.startswith(b"\x1aE\xdf\xa3"):
        if b"webm" in prefix.lower():
            return ".webm", "video/webm"
        return ".mkv", "video/x-matroska"
    if prefix.startswith(b"RIFF") and prefix[8:12] == b"AVI ":
        return ".avi", "video/x-msvideo"
    if prefix.startswith(b"OggS"):
        return ".ogv", "video/ogg"
    if prefix.startswith((b"\x00\x00\x01\xba", b"\x00\x00\x01\xb3")):
        return ".mpeg", "video/mpeg"
    return None


def _validate_declared_type(declared: str | None, detected: str) -> None:
    value = (declared or "").split(";", maxsplit=1)[0].strip().lower()
    if not value or value == "application/octet-stream":
        return
    aliases = {"image/jpg": "image/jpeg", "video/x-m4v": "video/mp4"}
    if aliases.get(value, value) != detected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": "File contents do not match the declared media type"},
        )


def _read_upload(file: UploadFile, *, max_bytes: int) -> bytes:
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
    return raw


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
    max_bytes = MAX_VIDEO_BYTES if kind == "gallery" else MAX_IMAGE_BYTES
    raw = _read_upload(file, max_bytes=max_bytes)
    detected = _detect_image(raw)
    if detected is None and kind == "gallery":
        detected = _detect_video(raw)
    if detected is None:
        message = "Unsupported or invalid image"
        if kind == "gallery":
            message = "Unsupported or invalid image/video"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": message},
        )

    ext, content_type = detected
    if ext in VIDEO_EXTENSIONS and kind != "gallery":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": "Video uploads are only allowed for gallery"},
        )
    if ext not in VIDEO_EXTENSIONS and len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "payload_too_large", "message": "Image is too large"},
        )
    _validate_declared_type(file.content_type, content_type)

    name = f"{uuid4().hex}{ext}"
    if _is_supabase_enabled(settings):
        storage_key = _supabase_object_key(settings, kind=kind, filename=name)
        _upload_to_supabase(
            settings,
            object_key=storage_key,
            raw=raw,
            content_type=content_type,
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
