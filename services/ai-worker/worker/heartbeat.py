import json
import os
import socket
import threading
from datetime import UTC, datetime

from redis import Redis

HEARTBEAT_KEY = "rvai:worker:heartbeat"


class WorkerHeartbeat:
    def __init__(
        self,
        client: Redis,
        interval_seconds: int = 10,
        ttl_seconds: int = 60,
        hostname: str | None = None,
    ) -> None:
        self._client = client
        self._interval = interval_seconds
        self._ttl = ttl_seconds
        self._hostname = hostname or socket.gethostname()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def payload(self) -> str:
        return json.dumps(
            {
                "hostname": self._hostname,
                "pid": os.getpid(),
                "ts": datetime.now(UTC).isoformat(),
            }
        )

    def beat(self) -> None:
        self._client.setex(HEARTBEAT_KEY, self._ttl, self.payload())

    def _run(self) -> None:
        while not self._stop_event.wait(self._interval):
            try:
                self.beat()
            except Exception:
                # The container healthcheck exposes persistent Redis failures.
                continue

    def start(self) -> None:
        self.beat()
        self._thread = threading.Thread(
            target=self._run, name="worker-heartbeat", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
