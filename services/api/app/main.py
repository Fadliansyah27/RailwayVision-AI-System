import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.api.router import api_router
from app.api.routes import health
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    BodySizeLimitMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)
from app.db.session import engine
from app.seed import seed_on_startup

logger = logging.getLogger("railwayvision.app")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await seed_on_startup()
        logger.info("api_started", extra={"event": "api_started"})
        try:
            yield
        finally:
            await app.state.redis.aclose()
            await engine.dispose()
            logger.info("api_stopped", extra={"event": "api_stopped"})

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-assisted railway infrastructure inspection decision-support prototype. "
            "AI output is advisory and requires authorized human review. "
            "This API provides no train-control or safety-clearance functions."
        ),
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
            "X-Refresh-Transport",
        ],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=settings.max_json_body_bytes,
        media_max_bytes=settings.media_max_bytes,
        media_path_prefix=f"{settings.api_v1_prefix}/media/",
    )
    app.add_middleware(SecurityHeadersMiddleware, enable_hsts=settings.enable_hsts)
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
