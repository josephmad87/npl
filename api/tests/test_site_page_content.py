import pytest
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1 import admin_routes, public_routes
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.site_page_content import SitePageContent
from app.models.user import User
from app.schemas.site_page_content import SitePageBody
from app.services.site_pages import DEFAULT_SITE_PAGES, default_site_page_body


EXPECTED_SLUGS = {
    "privacy",
    "terms",
    "support",
    "account-deletion",
}


def test_all_managed_pages_have_complete_defaults() -> None:
    assert set(DEFAULT_SITE_PAGES) == EXPECTED_SLUGS

    for slug in EXPECTED_SLUGS:
        page = default_site_page_body(slug)  # type: ignore[arg-type]
        assert page.title
        assert page.subtitle
        assert page.intro_html
        assert page.sections
        assert len({section.id for section in page.sections}) == len(page.sections)


def test_duplicate_section_ids_are_rejected() -> None:
    with pytest.raises(ValidationError, match="Section IDs must be unique"):
        SitePageBody.model_validate(
            {
                "title": "Example",
                "sections": [
                    {"id": "same", "heading": "First", "body_html": "<p>A</p>"},
                    {"id": "same", "heading": "Second", "body_html": "<p>B</p>"},
                ],
            },
        )


def test_section_ids_must_be_safe_html_anchors() -> None:
    with pytest.raises(ValidationError):
        SitePageBody.model_validate(
            {
                "title": "Example",
                "sections": [
                    {
                        "id": "Unsafe anchor!",
                        "heading": "Unsafe",
                        "body_html": "<p>Body</p>",
                    },
                ],
            },
        )


class FakeSession:
    def __init__(self, user: User | None = None) -> None:
        self.user = user
        self.site_pages: dict[str, SitePageContent] = {}
        self.audit_rows: list[AuditLog] = []

    def get(self, model: type[object], key: object) -> object | None:
        if model is User:
            return self.user if self.user and self.user.id == key else None
        if model is SitePageContent:
            return self.site_pages.get(str(key))
        return None

    def add(self, row: object) -> None:
        if isinstance(row, SitePageContent):
            if row.updated_at is None:
                row.updated_at = datetime.now(timezone.utc)
            self.site_pages[row.slug] = row
        if isinstance(row, AuditLog):
            self.audit_rows.append(row)

    def commit(self) -> None:
        return None

    def refresh(self, row: object) -> None:
        if isinstance(row, SitePageContent) and row.updated_at is None:
            row.updated_at = datetime.now(timezone.utc)


def make_test_app(db: FakeSession) -> FastAPI:
    app = FastAPI()
    app.include_router(public_routes.router, prefix="/api/v1")
    app.include_router(admin_routes.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: db
    return app


def make_user(role: str) -> User:
    return User(
        id=1,
        email=f"{role}@example.com",
        hashed_password="not-used",
        full_name=role,
        role=role,
        is_active=True,
    )


def authorization_header() -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token('1')}"}


def test_public_page_endpoint_returns_default_content() -> None:
    client = TestClient(make_test_app(FakeSession()))

    response = client.get("/api/v1/public/site-pages/privacy")

    assert response.status_code == 200
    payload = response.json()
    assert payload["slug"] == "privacy"
    assert payload["title"] == "Privacy Policy"
    assert payload["sections"]


def test_admin_page_endpoint_rejects_non_super_admin() -> None:
    db = FakeSession(make_user("content_editor"))
    client = TestClient(make_test_app(db))

    response = client.get(
        "/api/v1/admin/site-pages/privacy",
        headers=authorization_header(),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["message"] == "Super admin access required"


def test_super_admin_can_save_managed_page_content() -> None:
    db = FakeSession(make_user("super_admin"))
    client = TestClient(make_test_app(db))
    body = default_site_page_body("support").model_dump()
    body["title"] = "Help and support"

    response = client.patch(
        "/api/v1/admin/site-pages/support",
        headers=authorization_header(),
        json=body,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Help and support"
    assert db.site_pages["support"].body["title"] == "Help and support"
    assert db.audit_rows[-1].entity_type == "site_page_content"
