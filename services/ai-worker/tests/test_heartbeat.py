import json
from datetime import UTC, datetime, timedelta

import fakeredis

from worker.healthcheck import evaluate_heartbeat
from worker.heartbeat import HEARTBEAT_KEY, WorkerHeartbeat


def test_heartbeat_writes_fresh_payload():
    client = fakeredis.FakeRedis()
    heartbeat = WorkerHeartbeat(client, hostname="test-host")

    heartbeat.beat()

    raw = client.get(HEARTBEAT_KEY)
    assert raw is not None
    payload = json.loads(raw)
    assert payload["hostname"] == "test-host"
    assert "ts" in payload


def test_evaluate_heartbeat_accepts_fresh_payload():
    now = datetime.now(UTC)
    raw = json.dumps({"hostname": "w1", "ts": now.isoformat()})

    healthy, reason = evaluate_heartbeat(raw, now=now)

    assert healthy is True
    assert reason == "ok"


def test_evaluate_heartbeat_rejects_stale_payload():
    now = datetime.now(UTC)
    raw = json.dumps({"hostname": "w1", "ts": (now - timedelta(seconds=120)).isoformat()})

    healthy, reason = evaluate_heartbeat(raw, now=now, max_age_seconds=90)

    assert healthy is False
    assert "stale" in reason


def test_evaluate_heartbeat_rejects_missing_and_malformed():
    assert evaluate_heartbeat(None) == (False, "missing heartbeat")
    assert evaluate_heartbeat("not-json") == (False, "malformed heartbeat")
    assert evaluate_heartbeat(json.dumps({"hostname": "w1"})) == (False, "malformed heartbeat")


def test_ping_task_is_registered():
    import worker.tasks  # noqa: F401
    from worker.celery_app import celery_app

    assert "system.ping" in celery_app.tasks
