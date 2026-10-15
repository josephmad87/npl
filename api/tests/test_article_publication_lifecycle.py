from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import admin_routes, public_routes
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.article import Article
from app.models.audit import AuditLog
from app.models.seo_redirect import SeoRedirect
from app.models.user import User


@pytest.fixture
def article_api():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[User.__table__, Article.__table__, AuditLog.__table__, SeoRedirect.__table__],
    )
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        editor = User(email="editor@example.test", hashed_password="unused", role="content_editor")
        reader = User(email="reader@example.test", hashed_password="unused", role="read_only_admin")
        db.add_all([editor, reader])
        db.commit()
        editor_id, reader_id = editor.id, reader.id

    app = FastAPI()
    app.include_router(admin_routes.router, prefix="/api/v1")
    app.include_router(public_routes.router, prefix="/api/v1")

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client, sessions, {
            "editor": {"Authorization": f"Bearer {create_access_token(str(editor_id))}"},
            "reader": {"Authorization": f"Bearer {create_access_token(str(reader_id))}"},
        }
    engine.dispose()


def _create_story(client: TestClient, headers: dict[str, str], *, slug: str, published_at: datetime | None = None):
    response = client.post(
        "/api/v1/admin/news",
        headers=headers,
        json={
            "title": f"Story {slug}",
            "slug": slug,
            "status": "published" if published_at else "draft",
            "published_at": published_at.isoformat() if published_at else None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_future_story_appears_on_public_surfaces_only_when_due(article_api) -> None:
    client, _sessions, auth = article_api
    future = datetime.now(timezone.utc) + timedelta(hours=2)
    story = _create_story(client, auth["editor"], slug="timed-story", published_at=future)
    story_id = story["id"]

    assert [row["id"] for row in client.get("/api/v1/admin/news?status=scheduled", headers=auth["editor"]).json()["items"]] == [story_id]
    assert client.get("/api/v1/admin/news?status=published", headers=auth["editor"]).json()["items"] == []
    assert client.get("/api/v1/public/news").json()["items"] == []
    assert client.get("/api/v1/public/homepage-news").json() == []
    assert client.get("/api/v1/public/news/timed-story").status_code == 404

    due = datetime.now(timezone.utc) - timedelta(minutes=1)
    response = client.patch(
        f"/api/v1/admin/news/{story_id}",
        headers=auth["editor"],
        json={"published_at": due.isoformat()},
    )
    assert response.status_code == 200, response.text

    assert client.get("/api/v1/admin/news?status=scheduled", headers=auth["editor"]).json()["items"] == []
    assert [row["id"] for row in client.get("/api/v1/admin/news?status=published", headers=auth["editor"]).json()["items"]] == [story_id]
    assert [row["id"] for row in client.get("/api/v1/public/news").json()["items"]] == [story_id]
    assert [row["id"] for row in client.get("/api/v1/public/homepage-news").json()] == [story_id]
    assert client.get("/api/v1/public/news/timed-story").status_code == 200


def test_publish_now_overrides_a_future_publication_time(article_api) -> None:
    client, _sessions, auth = article_api
    future = datetime.now(timezone.utc) + timedelta(days=1)
    story = _create_story(client, auth["editor"], slug="publish-early", published_at=future)

    before = datetime.now(timezone.utc)
    response = client.post(f"/api/v1/admin/news/{story['id']}/publish", headers=auth["editor"])
    after = datetime.now(timezone.utc)

    assert response.status_code == 200, response.text
    published_at = datetime.fromisoformat(response.json()["published_at"])
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    assert before <= published_at <= after
    assert client.get("/api/v1/public/news/publish-early").status_code == 200


def test_existing_scheduled_status_goes_live_when_its_time_arrives(article_api) -> None:
    client, _sessions, auth = article_api
    future = datetime.now(timezone.utc) + timedelta(hours=2)
    created = client.post(
        "/api/v1/admin/news",
        headers=auth["editor"],
        json={
            "title": "Legacy scheduled story",
            "slug": "legacy-scheduled-story",
            "status": "scheduled",
            "published_at": future.isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    story_id = created.json()["id"]
    assert client.get("/api/v1/public/news/legacy-scheduled-story").status_code == 404

    due = datetime.now(timezone.utc) - timedelta(minutes=1)
    updated = client.patch(
        f"/api/v1/admin/news/{story_id}",
        headers=auth["editor"],
        json={"published_at": due.isoformat()},
    )
    assert updated.status_code == 200, updated.text
    assert client.get("/api/v1/public/news/legacy-scheduled-story").status_code == 200
    published = client.get("/api/v1/admin/news?status=published", headers=auth["editor"]).json()["items"]
    assert [story["id"] for story in published] == [story_id]
    assert client.get("/api/v1/admin/news?status=scheduled", headers=auth["editor"]).json()["items"] == []


def test_delete_story_removes_it_and_retires_its_redirect(article_api) -> None:
    client, sessions, auth = article_api
    story = _create_story(
        client, auth["editor"], slug="original-story", published_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )
    story_id = story["id"]
    renamed = client.patch(
        f"/api/v1/admin/news/{story_id}",
        headers=auth["editor"],
        json={"slug": "renamed-story"},
    )
    assert renamed.status_code == 200, renamed.text
    assert client.get("/api/v1/public/news/renamed-story").status_code == 200
    assert client.get("/api/v1/public/seo/redirect", params={"path": "/news/original-story"}).status_code == 200

    denied = client.delete(f"/api/v1/admin/news/{story_id}", headers=auth["reader"])
    assert denied.status_code == 403
    assert client.get(f"/api/v1/admin/news/{story_id}", headers=auth["editor"]).status_code == 200

    deleted = client.delete(f"/api/v1/admin/news/{story_id}", headers=auth["editor"])
    assert deleted.status_code == 204, deleted.text
    assert client.get(f"/api/v1/admin/news/{story_id}", headers=auth["editor"]).status_code == 404
    assert client.delete(f"/api/v1/admin/news/{story_id}", headers=auth["editor"]).status_code == 404
    assert client.get("/api/v1/public/news/renamed-story").status_code == 404
    assert client.get("/api/v1/public/news").json()["items"] == []
    assert client.get("/api/v1/public/seo/redirect", params={"path": "/news/original-story"}).status_code == 404

    with sessions() as db:
        assert db.get(Article, story_id) is None
        redirect = db.scalar(select(SeoRedirect).where(SeoRedirect.source_path == "/news/original-story"))
        assert redirect is not None and redirect.is_active is False
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.action == "delete",
                AuditLog.entity_type == "article",
                AuditLog.entity_id == str(story_id),
            )
        )
        assert audit is not None
        assert audit.summary == "Story original-story"
