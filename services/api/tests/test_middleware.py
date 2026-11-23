import re

import pytest

from app.core.config import Settings


async def test_security_headers_present(client):
    response = await client.get("/health/live")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "no-store"


async def test_request_id_is_generated(client):
    response = await client.get("/health/live")

    request_id = response.headers["x-request-id"]
    assert re.fullmatch(r"[A-Za-z0-9._-]{8,64}", request_id)


async def test_client_request_id_is_propagated(client):
    response = await client.get(
        "/health/live", headers={"X-Request-ID": "client-request-1234"}
    )

    assert response.headers["x-request-id"] == "client-request-1234"


async def test_invalid_request_id_is_replaced(client):
    response = await client.get("/health/live", headers={"X-Request-ID": "bad id!"})

    assert response.headers["x-request-id"] != "bad id!"


async def test_oversized_json_body_is_rejected(client):
    max_bytes = Settings().max_json_body_bytes
    response = await client.post(
        "/api/v1/meta", content=b"x" * (max_bytes + 1)
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


async def test_non_local_environment_requires_non_local_dependencies():
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            enable_hsts=True,
            database_url="postgresql+asyncpg://u:p@localhost:5432/db",
            redis_url="redis://redis:6379/0",
        )

    settings = Settings(
        app_env="production",
        enable_hsts=True,
        database_url="postgresql+asyncpg://u:p@db.internal:5432/db",
        redis_url="redis://redis.internal:6379/0",
        minio_endpoint="minio.internal:9000",
        minio_access_key="key",
        minio_secret_key="secret",
    )
    assert settings.docs_enabled is False


def test_cors_wildcard_is_rejected():
    with pytest.raises(ValueError):
        Settings(cors_allowed_origins="*")
