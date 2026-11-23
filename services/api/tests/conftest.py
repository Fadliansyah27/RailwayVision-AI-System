import os

os.environ["APP_ENV"] = "test"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["JWT_SECRET"] = "test-only-jwt-secret-0123456789abcdef01234567"
os.environ["SEED_PASSWORD"] = "Test-Sintetis-Password-2026"
os.environ["SEED_SYNTHETIC_DATA"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.seed import seed_rbac, seed_synthetic_content

PASSWORD = "Test-Sintetis-Password-2026"


class FakeRedis:
    def __init__(self, heartbeat: str | None = None) -> None:
        self.heartbeat = heartbeat
        self.counters: dict[str, int] = {}

    async def ping(self) -> bool:
        return True

    async def get(self, key: str) -> str | None:
        return self.heartbeat

    async def incr(self, key: str) -> int:
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    async def expire(self, key: str, seconds: int) -> bool:
        return True

    async def delete(self, key: str) -> int:
        self.counters.pop(key, None)
        return 1


class FailingRedis:
    async def ping(self) -> bool:
        raise ConnectionError("redis unavailable")

    async def get(self, key: str) -> str | None:
        raise ConnectionError("redis unavailable")


@pytest.fixture
def api_app():
    return app


@pytest.fixture
async def auth_client(api_app):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async with session_factory() as session:
        scopes = await seed_rbac(session)
        await seed_synthetic_content(session, scopes)
        await session.commit()

    api_app.dependency_overrides[get_db] = override_get_db
    api_app.state.redis = FakeRedis()
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    api_app.dependency_overrides.clear()
    await engine.dispose()


async def login(client: AsyncClient, email: str, password: str = PASSWORD, body: bool = False):
    headers = {"X-Refresh-Transport": "body"} if body else {}
    return await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers=headers,
    )


async def auth_headers(client: AsyncClient, email: str) -> dict[str, str]:
    response = await login(client, email)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
async def client(api_app):
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client
