import json
from datetime import UTC, datetime

from app.api.routes import health as health_routes
from tests.conftest import FailingRedis, FakeRedis


def _fresh_heartbeat() -> str:
    return json.dumps({"hostname": "test-worker", "ts": datetime.now(UTC).isoformat()})


async def test_liveness_returns_ok(client):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_ok_when_dependencies_available(client, api_app, monkeypatch):
    async def fake_database_check(engine):
        return "ok"

    monkeypatch.setattr(health_routes, "check_database", fake_database_check)
    api_app.state.redis = FakeRedis(heartbeat=_fresh_heartbeat())

    response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "components": {"database": "ok", "redis": "ok", "worker": "ok"},
    }


async def test_readiness_degraded_when_redis_unavailable(client, api_app, monkeypatch):
    async def fake_database_check(engine):
        return "ok"

    monkeypatch.setattr(health_routes, "check_database", fake_database_check)
    api_app.state.redis = FailingRedis()

    response = await client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["components"] == {"database": "ok", "redis": "error", "worker": "error"}


async def test_readiness_degraded_when_database_unavailable(client, api_app, monkeypatch):
    async def failing_database_check(engine):
        return "error"

    monkeypatch.setattr(health_routes, "check_database", failing_database_check)
    api_app.state.redis = FakeRedis(heartbeat=_fresh_heartbeat())

    response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["components"]["database"] == "error"
    assert response.json()["components"]["worker"] == "ok"


async def test_worker_stale_heartbeat_is_reported_without_failing_readiness(
    client, api_app, monkeypatch
):
    async def fake_database_check(engine):
        return "ok"

    monkeypatch.setattr(health_routes, "check_database", fake_database_check)
    api_app.state.redis = FakeRedis(
        heartbeat=json.dumps({"hostname": "w1", "ts": "2026-01-01T00:00:00+00:00"})
    )

    response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["components"]["worker"] == "error"
