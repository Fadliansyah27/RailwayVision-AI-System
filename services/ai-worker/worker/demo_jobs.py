import asyncio
import json
import logging
import uuid

import asyncpg
from minio import Minio
from minio.error import S3Error

from worker.config import get_settings
from worker.demo_ai import analyze_image_bytes

logger = logging.getLogger("railwayvision.demo_ai")

_ACTOR_LABEL = "system:ai-worker"


def _dsn(database_url: str) -> str:
    return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _minio_client() -> Minio:
    settings = get_settings()
    if not settings.minio_access_key or not settings.minio_secret_key:
        raise RuntimeError("minio credentials are not configured")
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


async def _audit(
    conn: asyncpg.Connection,
    job_id: uuid.UUID,
    scope_id: uuid.UUID | None,
    action: str,
    outcome: str,
    metadata: dict,
) -> None:
    await conn.execute(
        """
        INSERT INTO audit_events
            (id, actor_label, action, target_type, target_id, scope_id, outcome,
             event_metadata, created_at)
        VALUES ($1, $2, $3, 'ai_job', $4, $5, $6, $7::json, now())
        """,
        uuid.uuid4(),
        _ACTOR_LABEL,
        action,
        str(job_id),
        scope_id,
        outcome,
        json.dumps(metadata),
    )


async def _sync_inspection(
    conn: asyncpg.Connection, job_id: uuid.UUID, scope_id, new_status: str
) -> None:
    """Move the inspection out of ai_processing once no job is active."""
    result = await conn.execute(
        """
        UPDATE inspections i
        SET status = $2, version = i.version + 1, updated_at = now()
        WHERE i.id = (SELECT inspection_id FROM ai_jobs WHERE id = $1)
          AND i.status = 'ai_processing'
          AND NOT EXISTS (
              SELECT 1 FROM ai_jobs j
              WHERE j.inspection_id = i.id AND j.status IN ('queued', 'running')
          )
        """,
        job_id,
        new_status,
    )
    if not result.endswith("1"):
        return
    inspection_id = await conn.fetchval(
        "SELECT inspection_id FROM ai_jobs WHERE id = $1", job_id
    )
    await conn.execute(
        """
        INSERT INTO audit_events
            (id, actor_label, action, target_type, target_id, scope_id, outcome,
             event_metadata, created_at)
        VALUES ($1, $2, $3, 'inspection', $4, $5, 'success', $6::json, now())
        """,
        uuid.uuid4(),
        _ACTOR_LABEL,
        f"inspection.{new_status}",
        str(inspection_id),
        scope_id,
        json.dumps({"job_id": str(job_id), "new_status": new_status}),
    )


async def _fail(conn: asyncpg.Connection, job_id: uuid.UUID, scope_id, code: str) -> None:
    await conn.execute(
        "UPDATE ai_jobs SET status = 'failed', error_code = $2, finished_at = now(), "
        "updated_at = now() WHERE id = $1",
        job_id,
        code,
    )
    await _audit(conn, job_id, scope_id, "ai.demo_job_failed", "failure", {"error": code})
    await _sync_inspection(conn, job_id, scope_id, "ai_failed")


async def process_demo_job(job_id: uuid.UUID) -> None:
    settings = get_settings()
    conn = await asyncpg.connect(_dsn(settings.database_url))
    scope_id = None
    try:
        job = await conn.fetchrow(
            "SELECT j.inspection_id, j.media_id, j.model_id, i.scope_id "
            "FROM ai_jobs j JOIN inspections i ON i.id = j.inspection_id "
            "WHERE j.id = $1 AND j.status = 'queued'",
            job_id,
        )
        if job is None:
            logger.info("demo_ai_job_skipped", extra={"event": "demo_ai_job_skipped"})
            return
        scope_id = job["scope_id"]
        await conn.execute(
            "UPDATE ai_jobs SET status = 'running', started_at = now(), updated_at = now() "
            "WHERE id = $1",
            job_id,
        )
        media = await conn.fetchrow(
            "SELECT bucket, object_key, content_type, status FROM media_objects WHERE id = $1",
            job["media_id"],
        )
        if media is None or media["status"] != "ready":
            await _fail(conn, job_id, scope_id, "media_unavailable")
            return

        try:
            client = _minio_client()
            response = client.get_object(media["bucket"], media["object_key"])
            try:
                data = response.read()
            finally:
                response.close()
                response.release_conn()
        except (S3Error, OSError, RuntimeError):
            logger.warning(
                "demo_ai_storage_failed",
                extra={"event": "demo_ai_storage_failed", "outcome": "error"},
            )
            await _fail(conn, job_id, scope_id, "storage_unavailable")
            return

        try:
            result = analyze_image_bytes(data)
        except Exception:
            logger.warning(
                "demo_ai_decode_failed",
                extra={"event": "demo_ai_decode_failed", "outcome": "error"},
            )
            await _fail(conn, job_id, scope_id, "unsupported_image")
            return

        await conn.execute(
            "UPDATE ai_jobs SET status = 'succeeded', result = $2::json, "
            "finished_at = now(), updated_at = now() WHERE id = $1",
            job_id,
            json.dumps(result),
        )
        await _audit(
            conn,
            job_id,
            scope_id,
            "ai.demo_job_completed",
            "success",
            {"kind": result["kind"], "quality_flags": result["quality_flags"]},
        )
        await _sync_inspection(conn, job_id, scope_id, "ai_processed")
        logger.info(
            "demo_ai_job_succeeded",
            extra={"event": "demo_ai_job_succeeded", "media_id": str(job["media_id"])},
        )
    except Exception:
        logger.exception("demo_ai_job_crashed", extra={"event": "demo_ai_job_crashed"})
        if scope_id is not None:
            try:
                await _fail(conn, job_id, scope_id, "analysis_failed")
            except Exception:
                logger.exception(
                    "demo_ai_failure_record_failed",
                    extra={"event": "demo_ai_failure_record_failed"},
                )
    finally:
        await conn.close()


def run_demo_job(job_id: str) -> None:
    asyncio.run(process_demo_job(uuid.UUID(job_id)))
