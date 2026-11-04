import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.mfa import _totp_at
from app.core.security import create_refresh_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.audit import AuditLog
from app.models.user import User


def _client_and_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[User.__table__, AuditLog.__table__])
    sessions = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions, engine


def test_admin_login_requires_enrollment_then_totp_or_single_use_recovery_code() -> None:
    client, sessions, engine = _client_and_session()
    try:
        with sessions() as db:
            db.add(
                User(
                    email="admin@example.com",
                    hashed_password=hash_password("a-strong-admin-password"),
                    full_name="NPL Admin",
                    role="super_admin",
                    is_active=True,
                ),
            )
            db.commit()

        password_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "a-strong-admin-password"},
        )
        assert password_login.status_code == 200, password_login.text
        challenge = password_login.json()
        assert challenge["status"] == "mfa_enrollment_required"
        assert "access_token" not in challenge

        enrollment = client.post(
            "/api/v1/auth/mfa/enroll",
            json={"challenge_token": challenge["challenge_token"]},
        )
        assert enrollment.status_code == 200, enrollment.text
        setup = enrollment.json()
        assert setup["qr_data_uri"].startswith("data:image/png;base64,")
        assert setup["otpauth_uri"].startswith("otpauth://totp/")

        code = _totp_at(setup["secret"], int(time.time()))
        confirmation = client.post(
            "/api/v1/auth/mfa/confirm-enrollment",
            json={"challenge_token": challenge["challenge_token"], "code": code},
        )
        assert confirmation.status_code == 200, confirmation.text
        confirmed = confirmation.json()
        assert len(confirmed["recovery_codes"]) == 8
        access_token = confirmed["tokens"]["access_token"]
        refresh_token = confirmed["tokens"]["refresh_token"]

        legacy_refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": create_refresh_token("1")},
        )
        assert legacy_refresh.status_code == 401

        profile = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert profile.status_code == 200, profile.text
        assert profile.json()["mfa_enabled"] is True

        refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh.status_code == 200, refresh.text

        next_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "a-strong-admin-password"},
        )
        assert next_login.status_code == 200, next_login.text
        login_challenge = next_login.json()
        assert login_challenge["status"] == "mfa_required"
        assert "access_token" not in login_challenge

        invalid = client.post(
            "/api/v1/auth/mfa/verify",
            json={"challenge_token": login_challenge["challenge_token"], "code": "000000"},
        )
        assert invalid.status_code == 401

        totp_login = client.post(
            "/api/v1/auth/mfa/verify",
            json={"challenge_token": login_challenge["challenge_token"], "code": code},
        )
        assert totp_login.status_code == 200, totp_login.text

        recovery_code = confirmed["recovery_codes"][0]
        recovery_login = client.post(
            "/api/v1/auth/mfa/verify",
            json={"challenge_token": login_challenge["challenge_token"], "code": recovery_code},
        )
        assert recovery_login.status_code == 200, recovery_login.text

        reused_recovery = client.post(
            "/api/v1/auth/mfa/verify",
            json={"challenge_token": login_challenge["challenge_token"], "code": recovery_code},
        )
        assert reused_recovery.status_code == 401

        with sessions() as db:
            stored_user = db.query(User).filter(User.email == "admin@example.com").one()
            assert stored_user.mfa_secret_encrypted
            assert setup["secret"] not in stored_user.mfa_secret_encrypted
            assert recovery_code not in (stored_user.mfa_recovery_codes or "")
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
