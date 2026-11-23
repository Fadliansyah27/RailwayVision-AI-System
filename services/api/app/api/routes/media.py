import hashlib
import uuid
from datetime import UTC, datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_any_permission, require_permission
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.inspection_workflow import AI_QUEUE_STATUSES, TERMINAL_STATUSES
from app.db.session import get_db
from app.models.identity import Scope
from app.models.inspections import Inspection
from app.models.media import AIJob, AIModel, MediaObject
from app.schemas.common import Page
from app.schemas.media import (
    AIJobCreate,
    AIJobOut,
    AIModelBrief,
    AIModelCreate,
    AIModelOut,
    MediaIntent,
    MediaOut,
)
from app.services.access import accessible_scope_condition, user_brief
from app.services.audit import record_audit
from app.services.queue import TaskQueue, task_queue_dependency
from app.services.storage import (
    ALLOWED_IMAGE_TYPES,
    MinioStorage,
    StorageUnavailable,
    sniff_image_type,
    storage_dependency,
)

router = APIRouter(tags=["media"])

_CHUNK = 64 * 1024
_SNIFF = 16


def _now() -> datetime:
    return datetime.now(UTC)


def _media_out(media: MediaObject) -> MediaOut:
    return MediaOut(
        id=media.id,
        inspection_id=media.inspection_id,
        filename=media.filename,
        content_type=media.content_type,
        size_bytes=media.size_bytes,
        sha256=media.sha256,
        status=media.status,
        quarantine_reason=media.quarantine_reason,
        uploaded_by=user_brief(media.uploaded_by),
        uploaded_at=media.uploaded_at,
        created_at=media.created_at,
    )


def _job_out(job: AIJob) -> AIJobOut:
    return AIJobOut(
        id=job.id,
        inspection_id=job.inspection_id,
        media_id=job.media_id,
        status=job.status,
        error_code=job.error_code,
        result=job.result,
        model=AIModelBrief(
            id=job.model.id, code=job.model.code, name=job.model.name, version=job.model.version
        ),
        requested_by=user_brief(job.requested_by),
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


def _model_out(
    model: AIModel, usage_count: int = 0, last_used_at: datetime | None = None
) -> AIModelOut:
    return AIModelOut(
        id=model.id,
        code=model.code,
        name=model.name,
        version=model.version,
        family=model.family,
        modality=model.modality,
        description=model.description,
        is_demo=model.is_demo,
        status=model.status,
        approval_status=model.approval_status,
        dataset_version=model.dataset_version,
        checksum_sha256=model.checksum_sha256,
        class_names=model.class_names or [],
        training_config=model.training_config or {},
        evaluation_metrics=model.evaluation_metrics,
        evaluation_notes=model.evaluation_notes,
        known_limitations=model.known_limitations,
        approval_notes=model.approval_notes,
        approved_at=model.approved_at,
        deployed_at=model.deployed_at,
        retired_at=model.retired_at,
        usage_count=usage_count,
        last_used_at=last_used_at,
        created_at=model.created_at,
    )


async def _get_accessible_inspection(
    db: AsyncSession, ctx: AuthContext, inspection_id: uuid.UUID
) -> Inspection:
    stmt = (
        select(Inspection)
        .join(Scope, Inspection.scope_id == Scope.id)
        .where(
            Inspection.id == inspection_id,
            accessible_scope_condition(ctx.scope_path),
        )
    )
    inspection = (await db.execute(stmt)).scalar_one_or_none()
    if inspection is None:
        raise AppError(404, "not_found", "Inspeksi tidak ditemukan.")
    return inspection


async def _get_accessible_media(
    db: AsyncSession, ctx: AuthContext, media_id: uuid.UUID
) -> MediaObject:
    stmt = (
        select(MediaObject)
        .join(Scope, MediaObject.scope_id == Scope.id)
        .where(MediaObject.id == media_id, accessible_scope_condition(ctx.scope_path))
    )
    media = (await db.execute(stmt)).scalar_one_or_none()
    if media is None:
        raise AppError(404, "not_found", "Media tidak ditemukan.")
    return media


def _assert_can_attach(ctx: AuthContext, inspection: Inspection) -> None:
    if inspection.status in TERMINAL_STATUSES:
        raise AppError(409, "conflict", "Inspeksi ini tidak lagi menerima media.")
    if inspection.inspector_id != ctx.user.id and "inspections:manage" not in ctx.permissions:
        raise AppError(
            403,
            "forbidden",
            "Hanya inspektur yang ditugaskan yang dapat melampirkan media.",
        )


@router.post("/inspections/{inspection_id}/media", response_model=MediaOut, status_code=201)
async def create_media_intent(
    inspection_id: uuid.UUID,
    payload: MediaIntent,
    ctx: AuthContext = Depends(require_permission("media:upload")),
    db: AsyncSession = Depends(get_db),
) -> MediaOut:
    settings = get_settings()
    if payload.size_bytes > settings.media_max_bytes:
        raise AppError(413, "payload_too_large", "Gambar melebihi ukuran unggahan yang diizinkan.")
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    _assert_can_attach(ctx, inspection)

    extension = ALLOWED_IMAGE_TYPES[payload.content_type]
    media_id = uuid.uuid4()
    media = MediaObject(
        id=media_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        sha256=payload.sha256,
        status="pending_upload",
        bucket=settings.minio_media_bucket,
        object_key=f"inspections/{inspection.id}/{media_id}.{extension}",
        inspection_id=inspection.id,
        scope_id=inspection.scope_id,
        uploaded_by_id=ctx.user.id,
    )
    db.add(media)
    await record_audit(
        db,
        action="media.upload_requested",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={"filename": payload.filename, "size_bytes": payload.size_bytes},
    )
    await db.commit()
    media = (await db.execute(select(MediaObject).where(MediaObject.id == media_id))).scalar_one()
    return _media_out(media)


@router.put("/media/{media_id}/content", response_model=MediaOut)
async def upload_media_content(
    media_id: uuid.UUID,
    request: Request,
    ctx: AuthContext = Depends(require_permission("media:upload")),
    db: AsyncSession = Depends(get_db),
    storage: MinioStorage = Depends(storage_dependency),
) -> MediaOut:
    settings = get_settings()
    media = await _get_accessible_media(db, ctx, media_id)
    if media.status != "pending_upload":
        raise AppError(409, "conflict", "Unggahan ini sudah selesai.")
    if media.uploaded_by_id != ctx.user.id and "inspections:manage" not in ctx.permissions:
        raise AppError(403, "forbidden", "Hanya pengunggah yang dapat menyelesaikan unggahan ini.")

    header_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if header_type != media.content_type:
        raise AppError(422, "validation_error", "Content-Type tidak cocok dengan maksud unggahan.")

    digest = hashlib.sha256()
    buffer = bytearray()
    async for chunk in request.stream():
        buffer.extend(chunk)
        if len(buffer) > settings.media_max_bytes:
            raise AppError(
                413,
                "payload_too_large",
                "Gambar melebihi ukuran unggahan yang diizinkan.",
            )
        digest.update(chunk)
    if not buffer:
        raise AppError(422, "validation_error", "Unggahan kosong.")

    computed_sha = digest.hexdigest()
    reason: str | None = None
    if len(buffer) != media.size_bytes:
        reason = "size_mismatch"
    elif sniff_image_type(bytes(buffer[:_SNIFF])) != media.content_type:
        reason = "content_type_mismatch"
    elif computed_sha != media.sha256:
        reason = "checksum_mismatch"

    media.sha256 = computed_sha
    media.uploaded_at = _now()
    try:
        if reason is not None:
            quarantine_key = await storage.move_to_quarantine(
                media.object_key, bytes(buffer), media.content_type
            )
            media.status = "quarantined"
            media.bucket = settings.minio_quarantine_bucket
            media.object_key = quarantine_key
            media.quarantine_reason = reason
            await record_audit(
                db,
                action="media.quarantined",
                actor=ctx.user,
                target_type="media",
                target_id=media.id,
                scope_id=media.scope_id,
                outcome="failure",
                metadata={"reason": reason, "filename": media.filename},
            )
            await db.commit()
            raise AppError(422, "validation_error", f"Unggahan ditolak: {reason}.")
        await storage.put_bytes(media.bucket, media.object_key, bytes(buffer), media.content_type)
    except StorageUnavailable as exc:
        raise AppError(503, "service_unavailable", "Penyimpanan media tidak tersedia.") from exc

    media.status = "ready"
    media.quarantine_reason = None
    await record_audit(
        db,
        action="media.uploaded",
        actor=ctx.user,
        target_type="media",
        target_id=media.id,
        scope_id=media.scope_id,
        metadata={
            "filename": media.filename,
            "size_bytes": len(buffer),
            "content_type": media.content_type,
            "sha256": computed_sha,
        },
    )
    await db.commit()
    return _media_out(await _get_accessible_media(db, ctx, media.id))


@router.get("/inspections/{inspection_id}/media", response_model=Page[MediaOut])
async def list_inspection_media(
    inspection_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    ctx: AuthContext = Depends(require_permission("media:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[MediaOut]:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    total = (
        await db.execute(
            select(func.count())
            .select_from(MediaObject)
            .where(MediaObject.inspection_id == inspection.id)
        )
    ).scalar_one()
    stmt = (
        select(MediaObject)
        .where(MediaObject.inspection_id == inspection.id)
        .order_by(MediaObject.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()
    return Page[MediaOut](
        items=[_media_out(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/media/{media_id}/content")
async def get_media_content(
    media_id: uuid.UUID,
    download: bool = Query(default=False),
    ctx: AuthContext = Depends(require_permission("media:read")),
    db: AsyncSession = Depends(get_db),
    storage: MinioStorage = Depends(storage_dependency),
) -> Response:
    media = await _get_accessible_media(db, ctx, media_id)
    if media.status != "ready":
        raise AppError(409, "conflict", "Konten media tidak tersedia.")
    await record_audit(
        db,
        action="media.downloaded",
        actor=ctx.user,
        target_type="media",
        target_id=media.id,
        scope_id=media.scope_id,
        metadata={"filename": media.filename},
    )
    await db.commit()
    try:
        data = await storage.get_bytes(media.bucket, media.object_key)
    except StorageUnavailable as exc:
        raise AppError(503, "service_unavailable", "Penyimpanan media tidak tersedia.") from exc

    disposition = "attachment" if download else "inline"
    encoded_name = quote(media.filename, safe="")
    response = Response(content=data, media_type=media.content_type)
    response.headers["Content-Disposition"] = (
        f"{disposition}; filename=\"upload\"; filename*=UTF-8''{encoded_name}"
    )
    response.headers["Cache-Control"] = "private, no-store"
    return response


@router.post("/inspections/{inspection_id}/ai-jobs", response_model=AIJobOut, status_code=201)
async def create_ai_job(
    inspection_id: uuid.UUID,
    payload: AIJobCreate,
    ctx: AuthContext = Depends(require_permission("ai:enqueue")),
    db: AsyncSession = Depends(get_db),
    queue: TaskQueue = Depends(task_queue_dependency),
) -> AIJobOut:
    settings = get_settings()
    if not settings.synthetic_ai_enabled or settings.app_env == "production":
        raise AppError(
            409, "conflict", "Pipeline AI sintetis dinonaktifkan pada versi ini."
        )
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    media = (
        await db.execute(
            select(MediaObject).where(
                MediaObject.id == payload.media_id,
                MediaObject.inspection_id == inspection.id,
            )
        )
    ).scalar_one_or_none()
    if media is None:
        raise AppError(404, "not_found", "Media tidak ditemukan pada inspeksi ini.")
    if media.status != "ready":
        raise AppError(409, "conflict", "Hanya media tervalidasi yang dapat dianalisis.")
    if inspection.status not in AI_QUEUE_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Analisis AI hanya dapat diminta untuk inspeksi berstatus dikirim, "
            "diproses AI, atau pemrosesan AI gagal.",
        )
    previous_status = inspection.status

    model = (
        await db.execute(
            select(AIModel)
            .where(AIModel.status == "active", AIModel.is_demo.is_(True))
            .order_by(AIModel.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if model is None:
        raise AppError(409, "conflict", "Belum ada model AI sintetis yang terdaftar.")

    existing = (
        await db.execute(
            select(AIJob).where(
                AIJob.media_id == media.id,
                AIJob.model_id == model.id,
                AIJob.status.in_(("queued", "running")),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(
            409, "conflict", "Analisis sintetis untuk media ini sudah dalam antrean."
        )

    inspection.status = "ai_processing"
    inspection.version += 1
    job = AIJob(
        status="queued",
        inspection_id=inspection.id,
        media_id=media.id,
        model_id=model.id,
        requested_by_id=ctx.user.id,
    )
    db.add(job)
    await db.flush()
    await record_audit(
        db,
        action="ai.synthetic_job_queued",
        actor=ctx.user,
        target_type="ai_job",
        target_id=job.id,
        scope_id=inspection.scope_id,
        metadata={
            "model": model.code,
            "media_id": str(media.id),
            "previous_status": previous_status,
            "inspection_version": inspection.version,
        },
    )
    await db.commit()
    job_id = job.id

    try:
        await queue.enqueue_synthetic_quality_check(str(job_id))
    except AppError:
        failed = (await db.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        failed.status = "failed"
        failed.error_code = "queue_unavailable"
        failed.finished_at = _now()
        inspection.status = previous_status
        await record_audit(
            db,
            action="ai.synthetic_job_failed",
            actor=ctx.user,
            target_type="ai_job",
            target_id=job_id,
            scope_id=inspection.scope_id,
            outcome="failure",
            metadata={"error": "queue_unavailable"},
        )
        await db.commit()
        raise

    job = (await db.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
    return _job_out(job)


@router.get("/inspections/{inspection_id}/ai-jobs", response_model=Page[AIJobOut])
async def list_ai_jobs(
    inspection_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    ctx: AuthContext = Depends(require_permission("detections:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[AIJobOut]:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    total = (
        await db.execute(
            select(func.count()).select_from(AIJob).where(AIJob.inspection_id == inspection.id)
        )
    ).scalar_one()
    stmt = (
        select(AIJob)
        .where(AIJob.inspection_id == inspection.id)
        .order_by(AIJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    jobs = (await db.execute(stmt)).scalars().all()
    return Page[AIJobOut](
        items=[_job_out(job) for job in jobs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/models", response_model=Page[AIModelOut])
async def list_models(
    ctx: AuthContext = Depends(
        require_any_permission("models:manage", "detections:read", "audit:read")
    ),
    db: AsyncSession = Depends(get_db),
) -> Page[AIModelOut]:
    models = (await db.execute(select(AIModel).order_by(AIModel.created_at.asc()))).scalars().all()
    usage_rows = (
        await db.execute(
            select(
                AIJob.model_id,
                func.count(),
                func.max(AIJob.created_at),
            ).group_by(AIJob.model_id)
        )
    ).all()
    usage = {row[0]: (row[1], row[2]) for row in usage_rows}
    items = [
        _model_out(
            model,
            usage[model.id][0] if model.id in usage else 0,
            usage[model.id][1] if model.id in usage else None,
        )
        for model in models
    ]
    return Page[AIModelOut](
        items=items,
        total=len(items),
        page=1,
        page_size=len(items) or 1,
    )


@router.post("/models", response_model=AIModelOut, status_code=201)
async def register_model(
    payload: AIModelCreate,
    ctx: AuthContext = Depends(require_permission("models:manage")),
    db: AsyncSession = Depends(get_db),
) -> AIModelOut:
    duplicate = (
        await db.execute(select(AIModel).where(AIModel.code == payload.code))
    ).scalar_one_or_none()
    if duplicate is not None:
        raise AppError(409, "conflict", "Model dengan kode ini sudah ada.")
    model = AIModel(
        code=payload.code,
        family=(payload.family.strip() or payload.code),
        name=payload.name.strip(),
        version=payload.version.strip(),
        modality=payload.modality,
        description=payload.description.strip(),
        is_demo=payload.is_demo,
        status="active" if payload.is_demo else "candidate",
        approval_status="synthetic_only" if payload.is_demo else "draft",
        dataset_version=payload.dataset_version,
        checksum_sha256=payload.checksum_sha256,
        class_names=payload.class_names,
        training_config=payload.training_config,
        evaluation_metrics=payload.evaluation_metrics,
        evaluation_notes=payload.evaluation_notes.strip(),
        known_limitations=payload.known_limitations.strip(),
    )
    db.add(model)
    await db.flush()
    await record_audit(
        db,
        action="model.registered",
        actor=ctx.user,
        target_type="ai_model",
        target_id=model.id,
        metadata={
            "code": model.code,
            "version": model.version,
            "family": model.family,
            "is_demo": model.is_demo,
        },
    )
    await db.commit()
    return _model_out(model)
