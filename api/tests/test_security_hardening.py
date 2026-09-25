from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from starlette.datastructures import Headers
from starlette.requests import Request

from app.core.config import Settings
from app.main import app
from app.schemas.articles import ArticleCreate, ArticleOut
from app.schemas.matches import MatchCreate
from app.schemas.site_page_content import SitePageBody
from app.services.rate_limit import check_rate_limit, clear_rate_limits
from app.services.uploads import save_upload_file


def _request(host: str = "203.0.113.10") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": (host, 12345),
            "scheme": "https",
            "server": ("testserver", 443),
        },
    )


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (4, 4), "red").save(output, format="PNG")
    return output.getvalue()


def test_rich_html_is_sanitised_on_input_and_legacy_output() -> None:
    hostile = '<p onclick="bad()">Safe<script>alert(1)</script><a href="javascript:bad()">link</a></p>'
    article = ArticleCreate(title="Title", slug="title", body=hostile)
    assert article.body == '<p>Safe<a rel="noopener noreferrer">link</a></p>'

    legacy = ArticleOut.model_validate(
        {
            "id": 1,
            "title": "Title",
            "slug": "title",
            "excerpt": None,
            "body": hostile,
            "featured_image_url": None,
            "body_image_url": None,
            "author_name": None,
            "status": "published",
            "category": "mens",
            "tags": None,
            "seo_title": None,
            "seo_description": None,
            "published_at": None,
            "related_entities": None,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        },
    )
    assert "script" not in (legacy.body or "")
    assert "onclick" not in (legacy.body or "")

    page = SitePageBody.model_validate(
        {
            "title": "Privacy",
            "intro_html": hostile,
            "sections": [{"id": "one", "heading": "One", "body_html": hostile}],
        },
    )
    assert "script" not in page.intro_html
    assert "javascript:" not in page.sections[0].body_html


def test_production_settings_reject_placeholders() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            app_environment="production",
            database_url="postgresql://postgres:postgres@localhost/npl",
            secret_key="change-me-in-production-use-openssl-rand-hex-32",
            cors_origins="*",
        )


def test_production_settings_accept_explicit_secure_values() -> None:
    settings = Settings(
        _env_file=None,
        app_environment="production",
        database_url="postgresql://npl:secret@db.example/npl",
        secret_key="a-unique-production-key-with-more-than-32-characters",
        cors_origins="https://npl.co.zw,https://admin.npl.co.zw",
        public_base_url="https://api.npl.co.zw",
    )
    assert settings.app_environment == "production"


def test_match_broadcast_url_accepts_youtube_and_rejects_unsafe_schemes() -> None:
    valid = MatchCreate(
        category="mens",
        home_team_id=1,
        away_team_id=2,
        stream_url=" https://www.youtube.com/watch?v=abc123 ",
    )
    assert valid.stream_url == "https://www.youtube.com/watch?v=abc123"

    with pytest.raises(ValidationError):
        MatchCreate(
            category="mens",
            home_team_id=1,
            away_team_id=2,
            stream_url="javascript:alert(1)",
        )


def test_scoring_cors_preflight_allows_session_and_version_headers() -> None:
    client = TestClient(app)
    response = client.options(
        "/api/v1/admin/matches/1/live/balls",
        headers={
            "Origin": "https://stage-1--npl-admin.netlify.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "authorization,content-type,x-score-version,x-scoring-session"
            ),
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "https://stage-1--npl-admin.netlify.app"
    )


def test_rate_limit_rejects_requests_after_limit() -> None:
    clear_rate_limits()
    request = _request()
    check_rate_limit(request, scope="test", limit=2, window_seconds=60)
    check_rate_limit(request, scope="test", limit=2, window_seconds=60)
    with pytest.raises(HTTPException) as error:
        check_rate_limit(request, scope="test", limit=2, window_seconds=60)
    assert error.value.status_code == 429
    assert error.value.headers and "Retry-After" in error.value.headers


def test_public_form_rate_limit_runs_before_body_validation() -> None:
    clear_rate_limits()
    client = TestClient(app)
    for _ in range(5):
        assert client.post("/api/v1/public/contact", json={}).status_code == 422
    preview_origin = "https://stage-1--npl-website.netlify.app"
    blocked = client.post(
        "/api/v1/public/contact",
        json={},
        headers={"Origin": preview_origin},
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert blocked.headers["retry-after"]
    assert blocked.headers["access-control-allow-origin"] == preview_origin


def test_upload_uses_detected_image_type(tmp_path) -> None:
    settings = Settings(_env_file=None, media_root=str(tmp_path))
    upload = UploadFile(
        filename="misleading.jpg",
        file=BytesIO(_png_bytes()),
        headers=Headers({"content-type": "image/png"}),
    )
    storage_key = save_upload_file(settings, kind="news", file=upload)
    assert storage_key.endswith(".png")
    assert (tmp_path / storage_key).read_bytes().startswith(b"\x89PNG")


def test_upload_rejects_svg_and_mime_mismatch(tmp_path) -> None:
    settings = Settings(_env_file=None, media_root=str(tmp_path))
    svg = UploadFile(
        filename="logo.png",
        file=BytesIO(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        headers=Headers({"content-type": "image/png"}),
    )
    with pytest.raises(HTTPException) as svg_error:
        save_upload_file(settings, kind="teams", file=svg)
    assert svg_error.value.status_code == 400

    mismatch = UploadFile(
        filename="image.jpg",
        file=BytesIO(_png_bytes()),
        headers=Headers({"content-type": "image/jpeg"}),
    )
    with pytest.raises(HTTPException) as mismatch_error:
        save_upload_file(settings, kind="teams", file=mismatch)
    assert mismatch_error.value.status_code == 400
