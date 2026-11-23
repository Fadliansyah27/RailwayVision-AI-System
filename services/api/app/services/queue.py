import functools

import anyio
from celery import Celery

from app.core.config import get_settings
from app.core.errors import AppError


class TaskQueue:
    async def enqueue_synthetic_quality_check(self, job_id: str) -> None: ...


class CeleryTaskQueue(TaskQueue):
    def __init__(self) -> None:
        settings = get_settings()
        self._client = Celery(
            "railwayvision-api",
            broker=settings.celery_broker_url,
            backend=settings.celery_result_backend,
        )

    async def enqueue_synthetic_quality_check(self, job_id: str) -> None:
        send = functools.partial(
            self._client.send_task, "ai.synthetic_quality_check", args=[job_id]
        )
        try:
            await anyio.to_thread.run_sync(send)
        except Exception as exc:
            raise AppError(503, "service_unavailable", "Antrean tugas AI tidak tersedia.") from exc


_queue: CeleryTaskQueue | None = None


def task_queue_dependency() -> TaskQueue:
    global _queue
    if _queue is None:
        _queue = CeleryTaskQueue()
    return _queue
