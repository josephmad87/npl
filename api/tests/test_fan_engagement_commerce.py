from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.audit import AuditLog
from app.main import app
from app.models.match import FanPlayerMatchVote, Match, MatchPlayerStat, MatchResult
from app.models.league import League, Season
from app.models.merchandise import (
    MerchandiseOrder,
    MerchandiseOrderStatusEvent,
    MerchandiseProduct,
    MerchandiseProductTeam,
    MerchandiseProductVariant,
)
from app.models.player import Player
from app.models.supporter import (
    FanEngagementEvent,
    FanNotification,
    FanPushDevice,
    SupporterAccount,
    SupporterConsentEvent,
    SupporterPlayerFollow,
    SupporterTeamFollow,
)
from app.models.team import Team
from app.models.user import User
from app.services.fan_notifications import queue_fan_match_notifications
from app.services.rate_limit import clear_rate_limits


def _client_and_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tables = [
        User.__table__,
        AuditLog.__table__,
        League.__table__,
        Season.__table__,
        Team.__table__,
        Player.__table__,
        Match.__table__,
        MatchResult.__table__,
        MatchPlayerStat.__table__,
        SupporterAccount.__table__,
        SupporterConsentEvent.__table__,
        SupporterTeamFollow.__table__,
        SupporterPlayerFollow.__table__,
        FanPushDevice.__table__,
        FanNotification.__table__,
        FanEngagementEvent.__table__,
        FanPlayerMatchVote.__table__,
        MerchandiseProduct.__table__,
        MerchandiseProductTeam.__table__,
        MerchandiseProductVariant.__table__,
        MerchandiseOrder.__table__,
        MerchandiseOrderStatusEvent.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions, engine


def _register(client: TestClient, *, push: bool = True, analytics: bool = True) -> str:
    response = client.post(
        "/api/v1/supporters/auth/register",
        json={
            "email": "fan@example.com",
            "password": "a-strong-fan-password",
            "display_name": "NPL Fan",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-09",
            "push_consent": push,
            "marketing_consent": False,
            "analytics_consent": analytics,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def test_supporter_registration_consent_and_admin_boundary() -> None:
    clear_rate_limits()
    client, sessions, engine = _client_and_session()
    try:
        token = _register(client)
        headers = {"Authorization": f"Bearer {token}"}
        me = client.get("/api/v1/supporters/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["display_name"] == "NPL Fan"
        assert me.json()["push_consent"] is True

        # A public supporter token must never resolve to a privileged admin user.
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401

        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(SupporterConsentEvent)) == 5

        updated = client.patch(
            "/api/v1/supporters/me",
            headers=headers,
            json={"push_consent": False},
        )
        assert updated.status_code == 200
        assert updated.json()["push_consent"] is False
        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(SupporterConsentEvent)) == 6
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_match_stream_url_requires_a_supporter_session() -> None:
    clear_rate_limits()
    client, sessions, engine = _client_and_session()
    try:
        with sessions() as db:
            home = Team(name="Home Club", slug="stream-home", category="mens", status="active")
            away = Team(name="Away Club", slug="stream-away", category="mens", status="active")
            db.add_all([home, away])
            db.flush()
            match = Match(
                category="mens",
                home_team_id=home.id,
                away_team_id=away.id,
                status="live",
                is_published=True,
                stream_url="https://www.youtube.com/watch?v=abc123",
                stream_label="NPL Live",
            )
            db.add(match)
            db.commit()
            match_id = match.id

        public_match = client.get(f"/api/v1/public/matches/{match_id}")
        assert public_match.status_code == 200
        assert public_match.json()["stream_available"] is True
        assert public_match.json()["stream_url"] is None

        anonymous_stream = client.get(f"/api/v1/public/matches/{match_id}/stream")
        assert anonymous_stream.status_code == 401

        token = _register(client)
        stream = client.get(
            f"/api/v1/public/matches/{match_id}/stream",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert stream.status_code == 200
        assert stream.json() == {
            "match_id": match_id,
            "stream_url": "https://www.youtube.com/watch?v=abc123",
            "stream_label": "NPL Live",
        }
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_following_secure_fan_vote_and_notification_idempotency() -> None:
    clear_rate_limits()
    client, sessions, engine = _client_and_session()
    try:
        now = datetime.now(timezone.utc)
        with sessions() as db:
            home = Team(name="Home Club", slug="home-club", category="mens", status="active")
            away = Team(name="Away Club", slug="away-club", category="mens", status="active")
            db.add_all([home, away])
            db.flush()
            player = Player(full_name="Star Batter", slug="star-batter", team_id=home.id, category="mens", status="active")
            db.add(player)
            db.flush()
            match = Match(
                category="mens",
                home_team_id=home.id,
                away_team_id=away.id,
                start_time=now + timedelta(hours=1),
                status="scheduled",
                is_published=True,
            )
            db.add(match)
            db.commit()
            home_id, match_id, player_id = home.id, match.id, player.id

        token = _register(client)
        headers = {"Authorization": f"Bearer {token}"}
        assert client.put(f"/api/v1/supporters/follows/teams/{home_id}", headers=headers).status_code == 204
        follows = client.get("/api/v1/supporters/follows", headers=headers).json()
        assert [team["name"] for team in follows["teams"]] == ["Home Club"]

        with sessions() as db:
            assert queue_fan_match_notifications(db, now=now) == 1
            assert queue_fan_match_notifications(db, now=now) == 0
            notice = db.scalar(select(FanNotification))
            assert notice is not None and notice.event_type == "match_1h"

            match = db.get(Match, match_id)
            match.status = "completed"
            match.scorecard_finalized_at = now
            db.add(MatchResult(match_id=match_id, winning_team_id=home_id, score_summary="Home Club won"))
            db.add(
                MatchPlayerStat(
                    match_id=match_id,
                    player_id=player_id,
                    team_id=home_id,
                    lineup_order=1,
                    runs=80,
                    balls_faced=50,
                )
            )
            db.commit()

        anonymous_vote = client.post(
            f"/api/v1/public/matches/{match_id}/fan-player-vote",
            json={"player_id": player_id},
        )
        assert anonymous_vote.status_code == 401
        vote = client.post(
            f"/api/v1/public/matches/{match_id}/fan-player-vote",
            headers=headers,
            json={"player_id": player_id},
        )
        assert vote.status_code == 200, vote.text
        assert vote.json()["voter_player_id"] == player_id
        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(FanPlayerMatchVote)) == 1
            assert queue_fan_match_notifications(db, now=now) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_variant_stock_and_private_order_tracking() -> None:
    clear_rate_limits()
    client, sessions, engine = _client_and_session()
    try:
        with sessions() as db:
            team = Team(name="Club", slug="club", category="mens", status="active")
            db.add(team)
            db.flush()
            product = MerchandiseProduct(name="Club cap", status="active", price_text="USD 10", team_id=team.id)
            db.add(product)
            db.flush()
            variant = MerchandiseProductVariant(
                product_id=product.id,
                sku="CAP-RED",
                label="Red cap",
                colour="Red",
                price_text="USD 10",
                stock_quantity=2,
            )
            db.add(variant)
            db.commit()
            product_id, variant_id = product.id, variant.id

        response = client.post(
            "/api/v1/public/merchandise/orders",
            json={
                "product_id": product_id,
                "variant_id": variant_id,
                "customer_name": "Fan One",
                "phone": "+263700000000",
                "email": "fan1@example.com",
                "quantity": 2,
                "fulfilment_method": "delivery",
                "delivery_address": "1 Cricket Way, Harare",
            },
        )
        assert response.status_code == 201, response.text
        created = response.json()
        assert created["order_number"].startswith("NPL-")
        tracked = client.get(
            f"/api/v1/public/merchandise/order-tracking/{created['order_number']}",
            params={"token": created["tracking_token"]},
        )
        assert tracked.status_code == 200, tracked.text
        assert tracked.json()["variant_label"] == "Red cap"
        assert tracked.json()["timeline"][0]["status"] == "new"
        assert client.get(
            f"/api/v1/public/merchandise/order-tracking/{created['order_number']}",
            params={"token": "wrong-token-but-long-enough"},
        ).status_code == 404
        with sessions() as db:
            assert db.get(MerchandiseProductVariant, variant_id).stock_quantity == 0
            order = db.scalar(select(MerchandiseOrder))
            assert order is not None and order.fulfilment_method == "delivery"

            administrator = User(
                email="shop-admin@example.com",
                hashed_password="unused",
                full_name="Shop Administrator",
                role="super_admin",
                is_active=True,
            )
            db.add(administrator)
            db.commit()
            administrator_id = administrator.id

        admin_headers = {"Authorization": f"Bearer {create_access_token(str(administrator_id))}"}
        cancelled = client.patch(
            f"/api/v1/admin/merchandise/orders/{created['id']}",
            headers=admin_headers,
            json={"status": "cancelled", "public_message": "Order cancelled."},
        )
        assert cancelled.status_code == 200, cancelled.text
        with sessions() as db:
            assert db.get(MerchandiseProductVariant, variant_id).stock_quantity == 2

        reopened = client.patch(
            f"/api/v1/admin/merchandise/orders/{created['id']}",
            headers=admin_headers,
            json={"status": "confirmed"},
        )
        assert reopened.status_code == 409
        with sessions() as db:
            assert db.get(MerchandiseProductVariant, variant_id).stock_quantity == 2
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_admin_can_update_merchandise_with_variants() -> None:
    client, sessions, engine = _client_and_session()
    try:
        with sessions() as db:
            administrator = User(
                email="merch-editor@example.com",
                hashed_password="unused",
                full_name="Merchandise Editor",
                role="super_admin",
                is_active=True,
            )
            product = MerchandiseProduct(
                name="Club shirt",
                description="Original description",
                status="active",
                price_text="USD 20",
            )
            db.add_all([administrator, product])
            db.flush()
            db.add(
                MerchandiseProductVariant(
                    product_id=product.id,
                    sku="SHIRT-M",
                    label="Medium",
                    size="M",
                    price_text="USD 20",
                    stock_quantity=5,
                )
            )
            db.commit()
            administrator_id = administrator.id
            product_id = product.id

        response = client.patch(
            f"/api/v1/admin/merchandise/{product_id}",
            headers={"Authorization": f"Bearer {create_access_token(str(administrator_id))}"},
            json={
                "name": "Updated club shirt",
                "description": "Updated description",
                "variants": [
                    {
                        "sku": "shirt-m",
                        "label": "Medium shirt",
                        "size": "M",
                        "price_text": "USD 22",
                        "currency": "usd",
                        "stock_quantity": 8,
                    }
                ],
            },
        )

        assert response.status_code == 200, response.text
        updated = response.json()
        assert updated["name"] == "Updated club shirt"
        assert updated["description"] == "Updated description"
        assert len(updated["variants"]) == 1
        assert updated["variants"][0]["sku"] == "SHIRT-M"
        assert updated["variants"][0]["label"] == "Medium shirt"
        assert updated["variants"][0]["price_text"] == "USD 22"
        assert updated["variants"][0]["currency"] == "USD"
        assert updated["variants"][0]["stock_quantity"] == 8
        with sessions() as db:
            variant = db.scalar(
                select(MerchandiseProductVariant).where(
                    MerchandiseProductVariant.product_id == product_id,
                    MerchandiseProductVariant.sku == "SHIRT-M",
                )
            )
            assert variant is not None
            assert variant.label == "Medium shirt"
            assert variant.stock_quantity == 8
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
