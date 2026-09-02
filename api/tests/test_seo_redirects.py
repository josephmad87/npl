import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1 import public_routes
from app.db.session import get_db
from app.models.seo_redirect import SeoRedirect
from app.schemas.articles import ArticleCreate
from app.services.seo_redirects import normalise_public_path, record_seo_redirect


def test_redirect_registry_collapses_historical_slug_chains() -> None:
    engine = create_engine("sqlite://")
    SeoRedirect.__table__.create(engine)

    with Session(engine) as db:
        record_seo_redirect(
            db,
            source_path="/teams/old-name",
            target_path="/teams/new-name",
        )
        record_seo_redirect(
            db,
            source_path="/teams/new-name",
            target_path="/teams/current-name",
        )
        db.commit()

        rows = {row.source_path: row.target_path for row in db.scalars(select(SeoRedirect)).all()}

    assert rows == {
        "/teams/old-name": "/teams/current-name",
        "/teams/new-name": "/teams/current-name",
    }


def test_redirect_paths_are_local_and_normalised() -> None:
    assert normalise_public_path("/news/example/?preview=true#top") == "/news/example"
    assert normalise_public_path("/teams/Old Club") == "/teams/Old%20Club"

    with pytest.raises(ValueError, match="local absolute"):
        normalise_public_path("https://malicious.example/news/example")
    with pytest.raises(ValueError, match="local absolute"):
        normalise_public_path("//malicious.example/news/example")
    with pytest.raises(ValueError, match="local absolute"):
        normalise_public_path("/%2F%2Fmalicious.example/news/example")


def test_reverting_to_a_historical_slug_does_not_create_a_redirect_loop() -> None:
    engine = create_engine("sqlite://")
    SeoRedirect.__table__.create(engine)

    with Session(engine) as db:
        record_seo_redirect(
            db,
            source_path="/news/original",
            target_path="/news/revised",
        )
        record_seo_redirect(
            db,
            source_path="/news/revised",
            target_path="/news/original",
        )
        db.commit()

        original = db.scalar(
            select(SeoRedirect).where(SeoRedirect.source_path == "/news/original"),
        )
        revised = db.scalar(
            select(SeoRedirect).where(SeoRedirect.source_path == "/news/revised"),
        )

    assert original is not None and original.is_active is False
    assert revised is not None and revised.target_path == "/news/original"


def test_new_editorial_slugs_must_already_be_canonical() -> None:
    ArticleCreate(title="Valid", slug="valid-article-slug")

    with pytest.raises(ValidationError, match="string_pattern_mismatch"):
        ArticleCreate(title="Invalid", slug="Invalid_article slug")


def test_public_redirect_lookup_returns_only_registered_local_paths() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SeoRedirect.__table__.create(engine)
    with Session(engine) as db:
        db.add(
            SeoRedirect(
                source_path="/players/old-player",
                target_path="/players/current-player",
            ),
        )
        db.commit()

    app = FastAPI()
    app.include_router(public_routes.router, prefix="/api/v1")

    def override_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)

    response = client.get(
        "/api/v1/public/seo/redirect",
        params={"path": "/players/old-player"},
    )
    assert response.status_code == 200
    assert response.json()["target_path"] == "/players/current-player"

    unsafe = client.get(
        "/api/v1/public/seo/redirect",
        params={"path": "https://malicious.example/player"},
    )
    assert unsafe.status_code == 400
