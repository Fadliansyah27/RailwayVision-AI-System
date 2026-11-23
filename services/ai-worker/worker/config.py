from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["local", "test", "staging", "production"] = "local"
    log_level: str = "INFO"

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    # Shared with the API readiness probe; must be the same logical DB.
    heartbeat_redis_url: str = "redis://localhost:6379/0"

    database_url: str = (
        "postgresql+asyncpg://railwayvision:railwayvision_local@localhost:5432/railwayvision"
    )
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_secure: bool = False

    celery_task_soft_time_limit: int = 120
    celery_task_time_limit: int = 180
    celery_max_retries: int = 3

    worker_heartbeat_interval_seconds: int = 10
    worker_heartbeat_ttl_seconds: int = 60


@lru_cache
def get_settings() -> WorkerSettings:
    return WorkerSettings()
