import asyncio
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from starlette.requests import Request
from starlette.responses import Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app, security_headers
from app.api.v1.admin_routes import admin_create_news
from app.models.article import Article
from app.models.audit import AuditLog
from app.models.gallery import GalleryItem
from app.models.league import League, Season
from app.models.match import Match, MatchPlayerStat, MatchResult
from app.models.player import Player
from app.models.sponsor import Sponsor
from app.models.team import Team
from app.models.user import User
from app.schemas.articles import ArticleCreate
from app.schemas.homepage import HomepageArticleOut, HomepageMatchOut


def _get_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "query_string": b"",
            "headers": [],
            "client": ("203.0.113.10", 12345),
            "scheme": "https",
            "server": ("testserver", 443),
        },
    )


async def _ok_response(_request: Request) -> Response:
    return Response(status_code=200)


def test_homepage_payload_models_exclude_heavy_fields() -> None:
    assert "body" not in HomepageArticleOut.model_fields
    assert "player_stats" not in HomepageMatchOut.model_fields
    assert "description" not in HomepageMatchOut.model_fields


def test_homepage_and_live_cache_policies() -> None:
    homepage = asyncio.run(
        security_headers(_get_request("/api/v1/public/homepage"), _ok_response),
    )
    homepage_news = asyncio.run(
        security_headers(_get_request("/api/v1/public/homepage-news"), _ok_response),
    )
    live = asyncio.run(
        security_headers(_get_request("/api/v1/public/matches/7/live"), _ok_response),
    )

    assert homepage.headers["cache-control"] == (
        "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
    )
    assert homepage_news.headers["cache-control"] == "no-store"
    assert live.headers["cache-control"] == "no-store"


def test_newly_published_story_replaces_oldest_hero_story() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[User.__table__, Article.__table__, AuditLog.__table__],
    )
    testing_session = sessionmaker(bind=engine)
    now = datetime.now(timezone.utc)

    with testing_session() as session:
        actor = User(email="editor@example.test", hashed_password="unused", role="editor")
        session.add(actor)
        session.add_all(
            Article(
                title=f"News {index}",
                slug=f"news-{index}",
                status="published",
                published_at=now - timedelta(days=index + 1),
            )
            for index in range(5)
        )
        session.add(
            Article(
                title="Earlier story without a publication date",
                slug="earlier-story-without-date",
                status="published",
                created_at=now - timedelta(minutes=30),
            ),
        )
        session.commit()

        new_story = admin_create_news(
            ArticleCreate(title="New story", slug="new-story", status="published"),
            session,
            SimpleNamespace(id=actor.id),
        )
        assert new_story.published_at is not None

        session.add(Article(title="Unpublished story", slug="unpublished-story", status="draft"))
        session.commit()

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        hero_response = TestClient(app).get("/api/v1/public/homepage-news")
        news_response = TestClient(app).get("/api/v1/public/news?page=1&page_size=5")
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()

    assert hero_response.status_code == 200
    assert [story["title"] for story in hero_response.json()] == [
        "New story", "Earlier story without a publication date", "News 0", "News 1", "News 2",
    ]
    assert [story["title"] for story in news_response.json()["items"]] == [
        "New story", "Earlier story without a publication date", "News 0", "News 1", "News 2",
    ]


def test_compact_homepage_endpoint_excludes_heavy_fields() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    homepage_tables = [
        League.__table__,
        Team.__table__,
        Season.__table__,
        Player.__table__,
        Article.__table__,
        GalleryItem.__table__,
        Sponsor.__table__,
        Match.__table__,
        MatchResult.__table__,
        MatchPlayerStat.__table__,
    ]
    Base.metadata.create_all(engine, tables=homepage_tables)
    testing_session = sessionmaker(bind=engine)

    with testing_session() as session:
        league = League(name="NPL", slug="npl", category="mens")
        home = Team(name="Home Club", slug="home-club", category="mens", status="active")
        away = Team(name="Away Club", slug="away-club", category="mens", status="active")
        session.add_all([league, home, away])
        session.flush()
        season = Season(
            league_id=league.id,
            name="2026",
            slug="2026",
            status="active",
        )
        player = Player(
            full_name="Home Player",
            slug="home-player",
            team_id=home.id,
            category="mens",
            status="active",
        )
        session.add_all([season, player])
        session.flush()
        completed = Match(
            season_id=season.id,
            category="mens",
            home_team_id=home.id,
            away_team_id=away.id,
            match_date=date.today(),
            status="completed",
            is_published=True,
        )
        fixture = Match(
            season_id=season.id,
            category="mens",
            home_team_id=home.id,
            away_team_id=away.id,
            match_date=date.today(),
            status="scheduled",
            is_published=True,
        )
        published_at = datetime.now(timezone.utc)
        session.add_all(
            [
                completed,
                fixture,
                *[
                    Article(
                        title=f"News {index}",
                        slug=f"news-{index}",
                        body="This heavy body must not be returned.",
                        status="published",
                        published_at=published_at - timedelta(days=index),
                    )
                    for index in range(6)
                ],
                GalleryItem(
                    title="Photo",
                    slug="photo",
                    media_type="image",
                    file_url="https://example.test/photo.jpg",
                    status="published",
                ),
                Sponsor(name="Sponsor", image_url="https://example.test/sponsor.png"),
            ],
        )
        session.flush()
        fixture_id = fixture.id
        session.add_all(
            [
                MatchResult(
                    match_id=completed.id,
                    winning_team_id=home.id,
                    outcome="win",
                    result_status="official",
                ),
                GalleryItem(
                    title="Fixture photo",
                    slug="fixture-photo",
                    media_type="image",
                    file_url="https://example.test/fixture-photo.jpg",
                    status="published",
                    match_id=fixture.id,
                ),
                GalleryItem(
                    title="Completed match photo",
                    slug="completed-match-photo",
                    media_type="image",
                    file_url="https://example.test/completed-photo.jpg",
                    status="published",
                    match_id=completed.id,
                ),
            ],
        )
        session.commit()

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get(
            "/api/v1/public/homepage",
            headers={"Accept-Encoding": "gzip"},
        )
        news_response = TestClient(app).get("/api/v1/public/homepage-news")
        match_gallery_response = TestClient(app).get(
            f"/api/v1/public/gallery?match_id={fixture_id}",
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()

    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
    payload = response.json()
    assert len(payload["news"]) == 5
    assert [article["title"] for article in payload["news"]] == [
        "News 0",
        "News 1",
        "News 2",
        "News 3",
        "News 4",
    ]
    assert "body" not in payload["news"][0]
    assert news_response.status_code == 200
    assert news_response.json() == payload["news"]
    assert len(payload["fixtures"]) == 1
    assert len(payload["results"]) == 1
    assert "player_stats" not in payload["results"][0]
    assert len(payload["teams"]) == 2
    assert match_gallery_response.status_code == 200
    assert [item["title"] for item in match_gallery_response.json()["items"]] == [
        "Fixture photo",
    ]
