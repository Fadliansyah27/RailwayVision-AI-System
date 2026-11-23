from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_LOCAL_DB_MARKERS = ("railwayvision_local", "localhost", "127.0.0.1")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "RailwayVision AI API"
    app_version: str = "0.7.0"
    app_env: Literal["local", "test", "staging", "production"] = "local"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = (
        "postgresql+asyncpg://railwayvision:railwayvision_local@localhost:5432/railwayvision"
    )
    redis_url: str = "redis://localhost:6379/0"

    cors_allowed_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
    )
    max_json_body_bytes: int = 1_048_576
    enable_hsts: bool = False

    jwt_secret: str = "local-development-only-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    password_min_length: int = 10
    password_reset_minutes: int = 30
    login_max_attempts: int = 5
    login_window_seconds: int = 300

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Media: private S3-compatible storage (MinIO locally). No public URLs are issued;
    # the API mediates every read/write after RBAC and scope checks.
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_secure: bool = False
    minio_media_bucket: str = "railwayvision-media"
    minio_quarantine_bucket: str = "railwayvision-quarantine"
    media_max_bytes: int = 10_485_760
    demo_ai_enabled: bool = True

    seed_demo_data: bool = False
    demo_seed_password: str | None = None

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be one of DEBUG, INFO, WARNING, ERROR, CRITICAL")
        return normalized

    @field_validator("cors_allowed_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        if not origins:
            raise ValueError("CORS_ALLOWED_ORIGINS must contain at least one origin")
        for origin in origins:
            if origin == "*":
                raise ValueError("Wildcard CORS origins are not permitted")
            if not origin.startswith(("http://", "https://")):
                raise ValueError(f"Invalid CORS origin: {origin}")
        return ",".join(origins)

    @model_validator(mode="after")
    def validate_non_local_environment(self) -> "Settings":
        if self.app_env in {"staging", "production"}:
            if any(marker in self.database_url for marker in _LOCAL_DB_MARKERS):
                raise ValueError(
                    "DATABASE_URL must point to the approved non-local database "
                    "for staging/production"
                )
            if "localhost" in self.redis_url or "127.0.0.1" in self.redis_url:
                raise ValueError(
                    "REDIS_URL must point to the approved non-local service for staging/production"
                )
            if not self.enable_hsts:
                raise ValueError("ENABLE_HSTS must be true for staging/production")
            if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("local-development"):
                raise ValueError("JWT_SECRET must be a strong secret for staging/production")
            if self.seed_demo_data:
                raise ValueError("SEED_DEMO_DATA must be false outside local development")
            if not self.minio_access_key or not self.minio_secret_key:
                raise ValueError("MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required")
            if "localhost" in self.minio_endpoint or "127.0.0.1" in self.minio_endpoint:
                raise ValueError(
                    "MINIO_ENDPOINT must point to the approved storage service "
                    "for staging/production"
                )
        return self

    @property
    def cookie_secure(self) -> bool:
        return self.app_env in {"staging", "production"}

    @property
    def cors_origins(self) -> list[str]:
        return [origin for origin in self.cors_allowed_origins.split(",") if origin]

    @property
    def docs_enabled(self) -> bool:
        return self.app_env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
