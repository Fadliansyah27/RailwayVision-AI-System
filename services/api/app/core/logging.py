import json
import logging
import re
import sys
from collections import deque
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")

_KEY_VALUE_SECRET = re.compile(
    r"(?i)\b(password|passwd|secret|token|authorization|cookie|api[_-]?key|"
    r"client_secret|private_key|jwt)\b[\"']?\s*[:=]\s*[\"']?([^\s\"',;}]+)"
)
_BEARER_SECRET = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_JWT_SECRET = re.compile(
    r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"
)
_TOKEN_SECRET = re.compile(r"\b(?:gh[pousr]_|sk-)[A-Za-z0-9_-]{12,}")


def redact(value: str) -> str:
    """Remove credential-looking values before log records leave the process."""
    redacted = _BEARER_SECRET.sub("[REDACTED]", value)
    redacted = _JWT_SECRET.sub("[REDACTED]", redacted)
    redacted = _TOKEN_SECRET.sub("[REDACTED]", redacted)
    return _KEY_VALUE_SECRET.sub(r"\1=[REDACTED]", redacted)


_EXTRA_FIELDS = (
    "event",
    "method",
    "path",
    "status_code",
    "duration_ms",
    "actor_id",
    "target_type",
    "target_id",
    "outcome",
    "error_code",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
            "request_id": redact(request_id_var.get()),
        }
        for field in _EXTRA_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = redact(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=True, default=str)


def _entry_from_record(record: logging.LogRecord) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
        "level": record.levelname,
        "logger": record.name,
        "message": redact(record.getMessage()),
        "request_id": redact(request_id_var.get()),
    }
    for field in _EXTRA_FIELDS:
        value = getattr(record, field, None)
        if value is not None:
            entry[field] = redact(value) if isinstance(value, str) else value
    if record.exc_info:
        entry["exception"] = redact(logging.Formatter().formatException(record.exc_info))
    return entry


class MemoryLogHandler(logging.Handler):
    """Bounded in-process log buffer exposed through the operations console."""

    def __init__(self, capacity: int) -> None:
        super().__init__()
        self.entries: deque[dict[str, Any]] = deque(maxlen=capacity)

    @property
    def capacity(self) -> int:
        return self.entries.maxlen or 0

    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = _entry_from_record(record)
        except Exception:
            self.handleError(record)
            return
        with self.lock:
            self.entries.append(entry)

    def snapshot(self) -> list[dict[str, Any]]:
        with self.lock:
            return list(self.entries)


log_buffer: MemoryLogHandler | None = None


def configure_logging(level: str, buffer_capacity: int = 500) -> None:
    global log_buffer
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)

    if log_buffer is None:
        log_buffer = MemoryLogHandler(buffer_capacity)
    log_buffer.setLevel(logging.NOTSET)
    root.addHandler(log_buffer)
    root.setLevel(level)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True


def query_log_entries(
    *, level: str | None = None, search: str | None = None, limit: int = 200
) -> tuple[list[dict[str, Any]], int, int]:
    if log_buffer is None:
        return [], 0, 0
    entries = log_buffer.snapshot()
    retained = len(entries)
    filtered = entries
    if level:
        filtered = [entry for entry in filtered if entry["level"] == level]
    if search:
        term = search.strip().lower()
        if term:
            filtered = [
                entry
                for entry in filtered
                if term in entry["message"].lower()
                or term in entry["logger"].lower()
                or term in str(entry.get("path", "")).lower()
                or term in str(entry.get("event", "")).lower()
            ]
    newest_first = list(reversed(filtered))
    return newest_first[:limit], retained, log_buffer.capacity
