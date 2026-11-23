import json
import sys
from datetime import UTC, datetime

from redis import Redis

from worker.config import get_settings
from worker.heartbeat import HEARTBEAT_KEY

DEFAULT_MAX_AGE_SECONDS = 90


def evaluate_heartbeat(
    raw: str | None, now: datetime | None = None, max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS
) -> tuple[bool, str]:
    if raw is None:
        return False, "missing heartbeat"
    try:
        data = json.loads(raw)
        timestamp = datetime.fromisoformat(data["ts"])
    except (ValueError, KeyError, TypeError):
        return False, "malformed heartbeat"
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    current = now or datetime.now(UTC)
    age = (current - timestamp).total_seconds()
    if age < 0 or age > max_age_seconds:
        return False, f"stale heartbeat ({age:.0f}s)"
    return True, "ok"


def main() -> int:
    settings = get_settings()
    max_age = settings.worker_heartbeat_ttl_seconds + 30
    try:
        client = Redis.from_url(settings.heartbeat_redis_url)
        raw = client.get(HEARTBEAT_KEY)
    except Exception as exc:
        print(f"healthcheck failed: redis unavailable ({exc.__class__.__name__})")
        return 1
    healthy, reason = evaluate_heartbeat(
        raw.decode() if isinstance(raw, bytes) else raw,
        max_age_seconds=max_age,
    )
    print(f"worker health: {reason}")
    return 0 if healthy else 1


if __name__ == "__main__":
    sys.exit(main())
