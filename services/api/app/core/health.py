import asyncio
import json
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

READINESS_TIMEOUT_SECONDS = 2.0
WORKER_HEARTBEAT_KEY = "rvai:worker:heartbeat"
WORKER_HEARTBEAT_MAX_AGE_SECONDS = 90


async def check_database(engine: AsyncEngine) -> str:
    try:
        async with asyncio.timeout(READINESS_TIMEOUT_SECONDS):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


async def check_redis(client: Redis | None) -> str:
    if client is None:
        return "error"
    try:
        async with asyncio.timeout(READINESS_TIMEOUT_SECONDS):
            await client.ping()
        return "ok"
    except Exception:
        return "error"


async def check_worker(client: Redis | None) -> str:
    """Informational check; worker availability does not gate API readiness."""
    if client is None:
        return "error"
    try:
        async with asyncio.timeout(READINESS_TIMEOUT_SECONDS):
            raw = await client.get(WORKER_HEARTBEAT_KEY)
        if raw is None:
            return "error"
        if isinstance(raw, bytes):
            raw = raw.decode()
        timestamp = datetime.fromisoformat(json.loads(raw)["ts"])
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        age = (datetime.now(UTC) - timestamp).total_seconds()
        return "ok" if 0 <= age <= WORKER_HEARTBEAT_MAX_AGE_SECONDS else "error"
    except Exception:
        return "error"
