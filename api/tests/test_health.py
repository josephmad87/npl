from contextlib import contextmanager

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app import main


class HealthyConnection:
    def execute(self, _statement: object) -> None:
        return None


@contextmanager
def healthy_connect():
    yield HealthyConnection()


@contextmanager
def unhealthy_connect():
    raise OperationalError("SELECT 1", {}, RuntimeError("database unavailable"))
    yield


def test_liveness_endpoint_does_not_require_database() -> None:
    response = TestClient(main.app).get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_readiness_endpoint_reports_database_success(monkeypatch) -> None:
    monkeypatch.setattr(main.engine, "connect", healthy_connect)

    response = TestClient(main.app).get("/health/ready")

    assert response.status_code == 200
    assert response.json()["checks"]["database"] == "ok"


def test_readiness_endpoint_reports_database_failure(monkeypatch) -> None:
    monkeypatch.setattr(main.engine, "connect", unhealthy_connect)

    response = TestClient(main.app).get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "checks": {"database": "failed"},
    }
