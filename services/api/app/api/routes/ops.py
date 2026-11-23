import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_any_permission, require_permission
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import LOG_LEVELS, query_log_entries
from app.db.session import get_db
from app.models.assets import Asset, Location
from app.models.checklists import InspectionChecklistResult
from app.models.identity import AuditEvent, Scope, User
from app.models.inspections import Inspection, InspectionReview
from app.models.maintenance import Finding, Notification, WorkOrder
from app.models.media import AI_JOB_STATUSES, AIJob, MediaObject
from app.schemas.common import Page, UserBrief
from app.schemas.media import AIModelBrief
from app.schemas.ops import (
    BackupStatusOut,
    DeploymentCreate,
    DeploymentRecordOut,
    OpsAIJobOut,
    OpsLogEntry,
    OpsLogPage,
    SyntheticResetPreviewOut,
    SyntheticResetRequest,
    SyntheticResetResult,
)
from app.services.access import accessible_scope_condition
from app.services.audit import record_audit
from app.services.storage import StorageUnavailable, get_storage

router = APIRouter(prefix="/ops", tags=["operations"])

SYNTHETIC_SCOPE_CODES = ("SINTETIS-KCIC", "SINTETIS-NORTH", "SINTETIS-SOUTH")
SYNTHETIC_RESET_CONFIRMATION = "HAPUS DATA SINTETIS"
_DEPLOYMENT_ACTION = "deployment.recorded"


def _now() -> datetime:
    return datetime.now(UTC)


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _synthetic_reset_enabled() -> bool:
    return get_settings().app_env in {"local", "test"}


@dataclass(slots=True)
class _SyntheticResetPlan:
    scope_codes: list[str]
    inspections: list[uuid.UUID]
    reviews: list[uuid.UUID]
    checklist_results: list[uuid.UUID]
    ai_jobs: list[uuid.UUID]
    media: list[tuple[uuid.UUID, str, str]]
    findings: list[uuid.UUID]
    work_orders: list[uuid.UUID]
    notifications: list[uuid.UUID]
    assets: list[uuid.UUID]
    locations: list[uuid.UUID]

    def counts(self) -> dict[str, int]:
        return {
            "inspections": len(self.inspections),
            "inspection_reviews": len(self.reviews),
            "checklist_results": len(self.checklist_results),
            "ai_jobs": len(self.ai_jobs),
            "media_objects": len(self.media),
            "findings": len(self.findings),
            "work_orders": len(self.work_orders),
            "notifications": len(self.notifications),
            "assets": len(self.assets),
            "locations": len(self.locations),
        }

    def total(self) -> int:
        return sum(self.counts().values())


async def _ids(db: AsyncSession, stmt) -> list[uuid.UUID]:
    return list((await db.execute(stmt)).scalars().all())


async def _collect_synthetic_reset_plan(db: AsyncSession) -> _SyntheticResetPlan:
    scopes = (
        await db.execute(select(Scope).where(Scope.code.in_(SYNTHETIC_SCOPE_CODES)))
    ).scalars().all()
    scope_ids = [scope.id for scope in scopes]
    scope_codes = [scope.code for scope in scopes]
    if not scope_ids:
        return _SyntheticResetPlan(scope_codes, *([[] for _ in range(10)]))

    synthetic_user_ids = await _ids(
        db,
        select(User.id).where(User.email.like("%@sintetis.railwayvision.example")),
    )
    synthetic_inspection = [Inspection.scope_id.in_(scope_ids)]
    synthetic_owner = [Inspection.reference.ilike("SINTETIS-%")]
    if synthetic_user_ids:
        synthetic_owner.append(Inspection.inspector_id.in_(synthetic_user_ids))
    inspection_ids = await _ids(
        db,
        select(Inspection.id).where(*synthetic_inspection, or_(*synthetic_owner)),
    )
    review_ids = (
        await _ids(
            db,
            select(InspectionReview.id).where(InspectionReview.inspection_id.in_(inspection_ids)),
        )
        if inspection_ids
        else []
    )
    checklist_ids = (
        await _ids(
            db,
            select(InspectionChecklistResult.id).where(
                InspectionChecklistResult.inspection_id.in_(inspection_ids)
            ),
        )
        if inspection_ids
        else []
    )
    ai_job_ids = (
        await _ids(db, select(AIJob.id).where(AIJob.inspection_id.in_(inspection_ids)))
        if inspection_ids
        else []
    )
    media = (
        [
            (media_id, bucket, object_key)
            for media_id, bucket, object_key in (
                await db.execute(
                    select(MediaObject.id, MediaObject.bucket, MediaObject.object_key).where(
                        MediaObject.inspection_id.in_(inspection_ids)
                    )
                )
            ).all()
        ]
        if inspection_ids
        else []
    )
    finding_ids = (
        await _ids(
            db, select(Finding.id).where(Finding.inspection_id.in_(inspection_ids))
        )
        if inspection_ids
        else []
    )
    work_order_ids = (
        await _ids(db, select(WorkOrder.id).where(WorkOrder.finding_id.in_(finding_ids)))
        if finding_ids
        else []
    )

    target_ids = {
        *[str(value) for value in inspection_ids],
        *[str(value) for value in finding_ids],
        *[str(value) for value in work_order_ids],
        *[str(value) for value in ai_job_ids],
        *[str(media_id) for media_id, _, _ in media],
    }
    notification_ids = (
        await _ids(db, select(Notification.id).where(Notification.target_id.in_(target_ids)))
        if target_ids
        else []
    )

    remaining_inspection = select(Inspection.id).where(Inspection.asset_id == Asset.id)
    if inspection_ids:
        remaining_inspection = remaining_inspection.where(Inspection.id.not_in(inspection_ids))
    asset_ids = await _ids(
        db,
        select(Asset.id).where(
            Asset.scope_id.in_(scope_ids),
            Asset.code.ilike("SINTETIS-%"),
            ~exists(remaining_inspection),
        ),
    )

    remaining_asset = select(Asset.id).where(Asset.location_id == Location.id)
    if asset_ids:
        remaining_asset = remaining_asset.where(Asset.id.not_in(asset_ids))
    location_ids = await _ids(
        db,
        select(Location.id).where(
            Location.scope_id.in_(scope_ids),
            Location.code.ilike("SINTETIS-%"),
            ~exists(remaining_asset),
        ),
    )

    return _SyntheticResetPlan(
        scope_codes=scope_codes,
        inspections=list(inspection_ids),
        reviews=list(review_ids),
        checklist_results=list(checklist_ids),
        ai_jobs=list(ai_job_ids),
        media=list(media),
        findings=list(finding_ids),
        work_orders=list(work_order_ids),
        notifications=list(notification_ids),
        assets=list(asset_ids),
        locations=list(location_ids),
    )


async def _cleanup_media(plan: _SyntheticResetPlan) -> tuple[str, int, int]:
    if not plan.media:
        return "not_needed", 0, 0
    try:
        storage = get_storage()
    except StorageUnavailable:
        return "unavailable", 0, 0
    deleted = 0
    failed = 0
    for _, bucket, object_key in plan.media:
        try:
            await storage.delete_object(bucket, object_key)
            deleted += 1
        except StorageUnavailable:
            failed += 1
    return ("completed" if failed == 0 else "partial"), deleted, failed


@router.get("/ai-jobs", response_model=Page[OpsAIJobOut])
async def list_ops_ai_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None, max_length=16),
    inspection_id: uuid.UUID | None = Query(default=None),
    model_id: uuid.UUID | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    ctx: AuthContext = Depends(require_permission("detections:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[OpsAIJobOut]:
    if status is not None and status not in AI_JOB_STATUSES:
        raise AppError(422, "validation_error", "Status pekerjaan AI tidak didukung.")

    conditions = [accessible_scope_condition(ctx.scope_path)]
    if status:
        conditions.append(AIJob.status == status)
    if inspection_id is not None:
        conditions.append(AIJob.inspection_id == inspection_id)
    if model_id is not None:
        conditions.append(AIJob.model_id == model_id)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(Inspection.reference.ilike(term), MediaObject.filename.ilike(term))
        )

    total = (
        await db.execute(
            select(func.count())
            .select_from(AIJob)
            .join(Inspection, AIJob.inspection_id == Inspection.id)
            .join(MediaObject, AIJob.media_id == MediaObject.id)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(AIJob, Inspection, MediaObject)
            .join(Inspection, AIJob.inspection_id == Inspection.id)
            .join(MediaObject, AIJob.media_id == MediaObject.id)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(*conditions)
            .order_by(AIJob.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [
        OpsAIJobOut(
            id=job.id,
            inspection_id=inspection.id,
            inspection_reference=inspection.reference,
            inspection_status=inspection.status,
            media_id=media.id,
            media_filename=media.filename,
            status=job.status,
            error_code=job.error_code,
            model=AIModelBrief(
                id=job.model.id,
                code=job.model.code,
                name=job.model.name,
                version=job.model.version,
            ),
            requested_by=UserBrief.model_validate(job.requested_by),
            created_at=job.created_at,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )
        for job, inspection, media in rows
    ]
    return Page[OpsAIJobOut](items=items, total=total, page=page, page_size=page_size)


@router.get("/logs", response_model=OpsLogPage)
async def list_ops_logs(
    level: str | None = Query(default=None, max_length=16),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=200, ge=1, le=500),
    ctx: AuthContext = Depends(require_any_permission("ops:manage", "audit:read")),
) -> OpsLogPage:
    normalized_level = level.upper() if level else None
    if normalized_level is not None and normalized_level not in LOG_LEVELS:
        raise AppError(422, "validation_error", "Level log tidak didukung.")
    entries, retained, capacity = query_log_entries(
        level=normalized_level, search=search, limit=limit
    )
    return OpsLogPage(
        items=[OpsLogEntry.model_validate(entry) for entry in entries],
        retained=retained,
        capacity=capacity,
        generated_at=_now(),
        note=(
            "Buffer memori proses API. Catatan lama hilang saat API restart dan tidak "
            "menggantikan log agregasi infrastruktur."
        ),
    )


def _deployment_out(event: AuditEvent) -> DeploymentRecordOut:
    metadata = event.event_metadata or {}
    return DeploymentRecordOut(
        id=event.id,
        version=str(metadata.get("version", "")),
        environment=str(metadata.get("environment", "")),
        commit_sha=metadata.get("commit_sha"),
        notes=str(metadata.get("notes", "")),
        recorded_by=event.actor_label or "sistem",
        recorded_at=event.created_at,
    )


@router.get("/deployments", response_model=list[DeploymentRecordOut])
async def list_deployments(
    limit: int = Query(default=50, ge=1, le=100),
    ctx: AuthContext = Depends(require_any_permission("ops:manage", "audit:read")),
    db: AsyncSession = Depends(get_db),
) -> list[DeploymentRecordOut]:
    visible_scope_ids = select(Scope.id).where(
        accessible_scope_condition(ctx.scope_path)
    )
    events = (
        (
            await db.execute(
                select(AuditEvent)
                .where(
                    AuditEvent.action == _DEPLOYMENT_ACTION,
                    AuditEvent.target_type == "deployment",
                    or_(
                        AuditEvent.scope_id.is_(None),
                        AuditEvent.scope_id.in_(visible_scope_ids),
                    ),
                )
                .order_by(AuditEvent.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [_deployment_out(event) for event in events]


@router.post("/deployments", response_model=DeploymentRecordOut, status_code=201)
async def record_deployment(
    payload: DeploymentCreate,
    ctx: AuthContext = Depends(require_permission("ops:manage")),
    db: AsyncSession = Depends(get_db),
) -> DeploymentRecordOut:
    settings = get_settings()
    if payload.environment != settings.app_env:
        raise AppError(
            422,
            "validation_error",
            "Lingkungan deployment harus sama dengan APP_ENV layanan API ini.",
        )
    deployment_id = uuid.uuid4()
    recorded_at = _now()
    await record_audit(
        db,
        action=_DEPLOYMENT_ACTION,
        actor=ctx.user,
        target_type="deployment",
        target_id=deployment_id,
        scope_id=ctx.user.scope_id,
        metadata={
            "version": payload.version,
            "environment": payload.environment,
            "commit_sha": payload.commit_sha,
            "notes": payload.notes,
        },
    )
    await db.commit()
    return DeploymentRecordOut(
        id=deployment_id,
        version=payload.version,
        environment=payload.environment,
        commit_sha=payload.commit_sha,
        notes=payload.notes,
        recorded_by=ctx.user.email,
        recorded_at=recorded_at,
    )


@router.get("/backup", response_model=BackupStatusOut)
async def backup_status(
    ctx: AuthContext = Depends(require_any_permission("ops:manage", "audit:read")),
) -> BackupStatusOut:
    settings = get_settings()
    now = _now()
    base = {
        "checked_at": now,
        "max_age_hours": settings.backup_max_age_hours,
    }
    if not settings.backup_status_file:
        return BackupStatusOut(
            status="not_configured",
            configured=False,
            detail=(
                "BACKUP_STATUS_FILE belum diatur. Tidak ada status backup yang dilaporkan "
                "sebagai sehat."
            ),
            **base,
        )

    path = Path(settings.backup_status_file)
    try:
        if not path.is_file():
            return BackupStatusOut(
                status="unavailable",
                configured=True,
                detail="File status backup dikonfigurasi tetapi tidak ditemukan.",
                **base,
            )
        if path.stat().st_size > 65_536:
            return BackupStatusOut(
                status="invalid",
                configured=True,
                detail="File status backup melebihi batas 64 KB.",
                **base,
            )
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return BackupStatusOut(
            status="invalid",
            configured=True,
            detail="File status backup tidak dapat dibaca atau bukan JSON yang valid.",
            **base,
        )

    if not isinstance(payload, dict):
        return BackupStatusOut(
            status="invalid",
            configured=True,
            detail="Isi file status backup harus berupa objek JSON.",
            **base,
        )
    last_backup_at = _parse_timestamp(payload.get("last_backup_at"))
    if last_backup_at is None:
        return BackupStatusOut(
            status="invalid",
            configured=True,
            detail="Field last_backup_at tidak ada atau bukan waktu ISO-8601 yang valid.",
            **base,
        )

    size_bytes = payload.get("size_bytes")
    if not isinstance(size_bytes, int) or isinstance(size_bytes, bool) or size_bytes < 0:
        size_bytes = None
    checksum = payload.get("checksum_sha256")
    if not isinstance(checksum, str) or len(checksum) != 64:
        checksum = None
    last_restore_test_at = _parse_timestamp(payload.get("last_restore_test_at"))
    age_hours = round((now - last_backup_at).total_seconds() / 3600, 1)

    if age_hours < -1:
        status = "invalid"
        detail = "last_backup_at berada di masa depan; status backup tidak dipercaya."
    elif age_hours > settings.backup_max_age_hours:
        status = "stale"
        detail = (
            f"Backup terakhir berumur {age_hours} jam, melewati batas "
            f"{settings.backup_max_age_hours} jam."
        )
    else:
        status = "ok"
        detail = "Backup terakhir berada dalam batas umur yang dikonfigurasi."

    return BackupStatusOut(
        status=status,
        configured=True,
        last_backup_at=last_backup_at,
        age_hours=age_hours,
        size_bytes=size_bytes,
        checksum_sha256=checksum,
        last_restore_test_at=last_restore_test_at,
        detail=detail,
        **base,
    )


def _preview(plan: _SyntheticResetPlan) -> SyntheticResetPreviewOut:
    counts = plan.counts()
    enabled = _synthetic_reset_enabled()
    return SyntheticResetPreviewOut(
        enabled=enabled,
        environment=get_settings().app_env,
        confirmation_phrase=SYNTHETIC_RESET_CONFIRMATION,
        scope_codes=plan.scope_codes,
        counts=counts,
        total=sum(counts.values()),
        reason=(
            None
            if enabled
            else "Reset data hanya tersedia pada lingkungan local atau test."
        ),
    )


@router.get("/synthetic-reset/preview", response_model=SyntheticResetPreviewOut)
async def synthetic_reset_preview(
    ctx: AuthContext = Depends(require_permission("ops:manage")),
    db: AsyncSession = Depends(get_db),
) -> SyntheticResetPreviewOut:
    return _preview(await _collect_synthetic_reset_plan(db))


@router.post("/synthetic-reset", response_model=SyntheticResetResult)
async def reset_synthetic_data(
    payload: SyntheticResetRequest,
    ctx: AuthContext = Depends(require_permission("ops:manage")),
    db: AsyncSession = Depends(get_db),
) -> SyntheticResetResult:
    if not _synthetic_reset_enabled():
        raise AppError(
            409,
            "synthetic_reset_disabled",
            "Reset data hanya tersedia pada lingkungan local atau test.",
        )
    if payload.confirm.strip() != SYNTHETIC_RESET_CONFIRMATION:
        raise AppError(
            422,
            "validation_error",
            f"Frasa konfirmasi harus persis: {SYNTHETIC_RESET_CONFIRMATION}",
        )

    plan = await _collect_synthetic_reset_plan(db)
    counts = plan.counts()

    deletions = (
        (WorkOrder, plan.work_orders),
        (Finding, plan.findings),
        (Notification, plan.notifications),
        (AIJob, plan.ai_jobs),
        (MediaObject, [media_id for media_id, _, _ in plan.media]),
        (InspectionReview, plan.reviews),
        (InspectionChecklistResult, plan.checklist_results),
        (Inspection, plan.inspections),
        (Asset, plan.assets),
        (Location, plan.locations),
    )
    for model, identifiers in deletions:
        if identifiers:
            await db.execute(delete(model).where(model.id.in_(identifiers)))

    total = sum(counts.values())
    if total:
        await record_audit(
            db,
            action="synthetic_data.reset",
            actor=ctx.user,
            target_type="synthetic_data",
            scope_id=ctx.user.scope_id,
            metadata={"deleted": counts, "total": total},
        )
    await db.commit()

    storage_cleanup, storage_deleted, storage_failures = await _cleanup_media(plan)
    return SyntheticResetResult(
        deleted=counts,
        total=total,
        storage_cleanup=storage_cleanup,
        storage_objects_deleted=storage_deleted,
        storage_failures=storage_failures,
        completed_at=_now(),
    )
