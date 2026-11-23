from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.health import check_database, check_redis, check_worker
from app.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health/live", summary="Liveness probe")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/health/ready",
    summary="Readiness probe",
    description=(
        "Database and Redis gate readiness. The AI worker heartbeat is reported "
        "for information only, because inference is asynchronous."
    ),
)
async def readiness(request: Request) -> JSONResponse:
    redis_client = getattr(request.app.state, "redis", None)
    database = await check_database(engine)
    redis = await check_redis(redis_client)
    worker = await check_worker(redis_client)
    healthy = database == "ok" and redis == "ok"
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if healthy else "degraded",
            "components": {"database": database, "redis": redis, "worker": worker},
        },
    )
