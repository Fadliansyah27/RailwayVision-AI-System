import logging

from celery import Celery
from celery.signals import worker_ready, worker_shutdown
from redis import Redis

from worker.config import get_settings
from worker.heartbeat import WorkerHeartbeat

settings = get_settings()

celery_app = Celery(
    "railwayvision-worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    task_track_started=True,
    task_soft_time_limit=settings.celery_task_soft_time_limit,
    task_time_limit=settings.celery_task_time_limit,
)

logger = logging.getLogger("railwayvision.worker")

_heartbeat: WorkerHeartbeat | None = None


@worker_ready.connect
def start_heartbeat(**kwargs) -> None:
    global _heartbeat
    client = Redis.from_url(settings.heartbeat_redis_url)
    _heartbeat = WorkerHeartbeat(
        client,
        interval_seconds=settings.worker_heartbeat_interval_seconds,
        ttl_seconds=settings.worker_heartbeat_ttl_seconds,
    )
    _heartbeat.start()
    logger.info("worker_heartbeat_started")


@worker_shutdown.connect
def stop_heartbeat(**kwargs) -> None:
    if _heartbeat is not None:
        _heartbeat.stop()
    logger.info("worker_heartbeat_stopped")
