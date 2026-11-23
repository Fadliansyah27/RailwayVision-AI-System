import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_any_permission, require_permission
from app.core.errors import AppError
from app.core.inspection_workflow import (
    CANCELLABLE_STATUSES,
    DECIDABLE_STATUSES,
    EDITABLE_STATUSES,
    INSPECTION_STATUSES,
    REOPENABLE_STATUSES,
    REVIEW_DECISION_STATUSES,
    REVIEW_START_STATUSES,
)
from app.db.session import get_db
from app.models.assets import Asset
from app.models.identity import Scope
from app.models.inspections import Inspection, InspectionReview
from app.models.media import AIJob, MediaObject
from app.schemas.common import AssetBrief, Page, ScopeOut
from app.schemas.inspections import (
    InspectionChecklistUpdate,
    InspectionCreate,
    InspectionDetail,
    InspectionOut,
    InspectionReviewCreate,
    InspectionReviewOut,
    InspectionSummaryOut,
    InspectionUpdate,
)
from app.services.access import accessible_scope_condition, user_brief
from app.services.audit import record_audit
from app.services.checklists import (
    checklist_for_inspection,
    ensure_checklist_complete,
    load_checklist_results,
    replace_checklist_snapshot,
    snapshot_checklist,
)

router = APIRouter(tags=["inspections"])


def _inspection_out(inspection: Inspection) -> InspectionOut:
    return InspectionOut(
        id=inspection.id,
        reference=inspection.reference,
        status=inspection.status,
        inspection_type=inspection.inspection_type,
        location_reference=inspection.location_reference,
        notes=inspection.notes,
        inspected_at=inspection.inspected_at,
        version=inspection.version,
        asset=AssetBrief.model_validate(inspection.asset),
        inspector=user_brief(inspection.inspector),
        scope=ScopeOut.model_validate(inspection.scope),
        created_at=inspection.created_at,
        updated_at=inspection.updated_at,
    )


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _new_reference() -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return f"INS-{stamp}-{secrets.token_hex(3).upper()}"


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


async def _get_accessible_asset(db: AsyncSession, ctx: AuthContext, asset_id: uuid.UUID) -> Asset:
    stmt = (
        select(Asset)
        .join(Scope, Asset.scope_id == Scope.id)
        .where(Asset.id == asset_id, accessible_scope_condition(ctx.scope_path))
    )
    asset = (await db.execute(stmt)).scalar_one_or_none()
    if asset is None:
        raise AppError(404, "not_found", "Aset tidak ditemukan.")
    return asset


def _assert_can_edit(ctx: AuthContext, inspection: Inspection) -> None:
    if inspection.status not in EDITABLE_STATUSES:
        raise AppError(409, "conflict", "Hanya inspeksi draf yang dapat diubah.")
    if inspection.inspector_id != ctx.user.id and "inspections:manage" not in ctx.permissions:
        raise AppError(
            403,
            "forbidden",
            "Hanya inspektur yang ditugaskan yang dapat mengubah draf ini.",
        )


@router.get("/inspections", response_model=Page[InspectionOut])
async def list_inspections(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None, max_length=24),
    asset_id: uuid.UUID | None = Query(default=None),
    mine: bool = Query(default=False),
    ctx: AuthContext = Depends(require_any_permission("inspections:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[InspectionOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if status:
        conditions.append(Inspection.status == status)
    if asset_id is not None:
        conditions.append(Inspection.asset_id == asset_id)
    if mine:
        conditions.append(Inspection.inspector_id == ctx.user.id)

    total = (
        await db.execute(
            select(func.count())
            .select_from(Inspection)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(Inspection)
        .join(Scope, Inspection.scope_id == Scope.id)
        .where(*conditions)
        .order_by(Inspection.inspected_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    inspections = (await db.execute(stmt)).scalars().all()
    return Page[InspectionOut](
        items=[_inspection_out(inspection) for inspection in inspections],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/inspections", response_model=InspectionOut, status_code=201)
async def create_inspection(
    payload: InspectionCreate,
    ctx: AuthContext = Depends(require_permission("inspections:write")),
    db: AsyncSession = Depends(get_db),
) -> InspectionOut:
    asset = await _get_accessible_asset(db, ctx, payload.asset_id)
    inspection = Inspection(
        reference=_new_reference(),
        status="draft",
        inspection_type=payload.inspection_type,
        location_reference=payload.location_reference.strip(),
        notes=payload.notes.strip(),
        inspected_at=(
            _normalize_datetime(payload.inspected_at) if payload.inspected_at else datetime.now(UTC)
        ),
        asset_id=asset.id,
        inspector_id=ctx.user.id,
        scope_id=asset.scope_id,
    )
    db.add(inspection)
    await db.flush()
    checklist_items = await snapshot_checklist(db, inspection)
    await record_audit(
        db,
        action="inspection.created",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={
            "reference": inspection.reference,
            "asset": asset.code,
            "checklist_items": checklist_items,
        },
    )
    await db.commit()
    return _inspection_out(await _get_accessible_inspection(db, ctx, inspection.id))


@router.get("/inspections/summary", response_model=InspectionSummaryOut)
async def inspections_summary(
    ctx: AuthContext = Depends(require_permission("inspections:read")),
    db: AsyncSession = Depends(get_db),
) -> InspectionSummaryOut:
    rows = (
        await db.execute(
            select(Inspection.status, func.count())
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(accessible_scope_condition(ctx.scope_path))
            .group_by(Inspection.status)
        )
    ).all()
    counts = {status: 0 for status in INSPECTION_STATUSES}
    for status, count in rows:
        counts[status] = count
    return InspectionSummaryOut(total=sum(counts.values()), counts=counts)


@router.get("/inspections/{inspection_id}", response_model=InspectionDetail)
async def get_inspection(
    inspection_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("inspections:read")),
    db: AsyncSession = Depends(get_db),
) -> InspectionDetail:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    return await _inspection_detail(db, inspection)


async def _inspection_detail(db: AsyncSession, inspection: Inspection) -> InspectionDetail:
    base = _inspection_out(inspection)
    media_count = (
        await db.execute(
            select(func.count())
            .select_from(MediaObject)
            .where(
                MediaObject.inspection_id == inspection.id,
                MediaObject.status == "ready",
            )
        )
    ).scalar_one()
    pending_detections = (
        await db.execute(
            select(func.count())
            .select_from(AIJob)
            .where(
                AIJob.inspection_id == inspection.id,
                AIJob.status.in_(("queued", "running")),
            )
        )
    ).scalar_one()
    reviews = (
        (
            await db.execute(
                select(InspectionReview)
                .where(InspectionReview.inspection_id == inspection.id)
                .order_by(InspectionReview.created_at.desc())
                .limit(20)
            )
        )
        .scalars()
        .all()
    )
    return InspectionDetail(
        **base.model_dump(),
        media_count=media_count,
        pending_detections=pending_detections,
        checklist=await checklist_for_inspection(db, inspection.id),
        reviews=[
            InspectionReviewOut(
                id=review.id,
                decision=review.decision,
                notes=review.notes,
                reviewer=user_brief(review.reviewer),
                created_at=review.created_at,
            )
            for review in reviews
        ],
    )


@router.patch("/inspections/{inspection_id}", response_model=InspectionOut)
async def update_inspection(
    inspection_id: uuid.UUID,
    payload: InspectionUpdate,
    ctx: AuthContext = Depends(require_permission("inspections:write")),
    db: AsyncSession = Depends(get_db),
) -> InspectionOut:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    _assert_can_edit(ctx, inspection)
    if payload.version is not None and payload.version != inspection.version:
        raise AppError(
            409, "conflict", "Inspeksi ini diubah oleh sesi lain. Muat ulang lalu coba lagi."
        )

    changed: list[str] = []
    if (
        payload.inspection_type is not None
        and payload.inspection_type != inspection.inspection_type
    ):
        inspection.inspection_type = payload.inspection_type
        await replace_checklist_snapshot(db, inspection)
        changed.append("inspection_type")
    if payload.location_reference is not None:
        inspection.location_reference = payload.location_reference.strip()
        changed.append("location_reference")
    if payload.notes is not None:
        inspection.notes = payload.notes.strip()
        changed.append("notes")
    if payload.inspected_at is not None:
        inspection.inspected_at = _normalize_datetime(payload.inspected_at)
        changed.append("inspected_at")
    inspection.version += 1

    await record_audit(
        db,
        action="inspection.updated",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={"fields": changed, "version": inspection.version},
    )
    await db.commit()
    return _inspection_out(await _get_accessible_inspection(db, ctx, inspection_id))


@router.post("/inspections/{inspection_id}/submit", response_model=InspectionOut)
async def submit_inspection(
    inspection_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("inspections:submit")),
    db: AsyncSession = Depends(get_db),
) -> InspectionOut:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    _assert_can_edit(ctx, inspection)
    await ensure_checklist_complete(db, inspection.id)
    inspection.status = "submitted"
    inspection.version += 1
    await record_audit(
        db,
        action="inspection.submitted",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={"reference": inspection.reference},
    )
    await db.commit()
    return _inspection_out(await _get_accessible_inspection(db, ctx, inspection_id))


@router.patch("/inspections/{inspection_id}/checklist", response_model=InspectionDetail)
async def update_inspection_checklist(
    inspection_id: uuid.UUID,
    payload: InspectionChecklistUpdate,
    ctx: AuthContext = Depends(require_permission("inspections:write")),
    db: AsyncSession = Depends(get_db),
) -> InspectionDetail:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    _assert_can_edit(ctx, inspection)
    if payload.version is not None and payload.version != inspection.version:
        raise AppError(
            409, "conflict", "Inspeksi ini diubah oleh sesi lain. Muat ulang lalu coba lagi."
        )

    rows = await load_checklist_results(db, inspection.id)
    if not rows:
        await snapshot_checklist(db, inspection)
        await db.flush()
        rows = await load_checklist_results(db, inspection.id)
    if not rows:
        raise AppError(
            409,
            "conflict",
            "Tidak ada template checklist aktif untuk jenis inspeksi ini.",
        )

    by_code = {row.item_code.upper(): row for row in rows}
    unknown = [
        entry.item_code for entry in payload.entries if entry.item_code.upper() not in by_code
    ]
    if unknown:
        raise AppError(
            422,
            "unknown_checklist_item",
            f"Item checklist tidak dikenal: {', '.join(unknown[:5])}.",
        )

    for entry in payload.entries:
        row = by_code[entry.item_code.upper()]
        row.result = entry.result
        row.notes = entry.notes.strip()
        row.recorded_by_id = ctx.user.id

    inspection.version += 1
    answered = sum(1 for row in rows if row.result is not None)
    await record_audit(
        db,
        action="inspection.checklist_updated",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={
            "reference": inspection.reference,
            "entries": len(payload.entries),
            "answered": answered,
            "version": inspection.version,
        },
    )
    await db.commit()
    refreshed = await _get_accessible_inspection(db, ctx, inspection_id)
    return await _inspection_detail(db, refreshed)


@router.post("/inspections/{inspection_id}/cancel", response_model=InspectionOut)
async def cancel_inspection(
    inspection_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("inspections:manage")),
    db: AsyncSession = Depends(get_db),
) -> InspectionOut:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    if inspection.status not in CANCELLABLE_STATUSES:
        raise AppError(409, "conflict", "Inspeksi ini tidak dapat dibatalkan.")
    inspection.status = "cancelled"
    inspection.version += 1
    await record_audit(
        db,
        action="inspection.cancelled",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
    )
    await db.commit()
    return _inspection_out(await _get_accessible_inspection(db, ctx, inspection_id))


@router.post("/inspections/{inspection_id}/review/start", response_model=InspectionDetail)
async def start_review(
    inspection_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("review:decide")),
    db: AsyncSession = Depends(get_db),
) -> InspectionDetail:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    if inspection.status not in REVIEW_START_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya inspeksi yang dikirim atau telah selesai diproses AI yang dapat "
            "masuk peninjauan manusia.",
        )
    if inspection.inspector_id == ctx.user.id:
        raise AppError(
            403,
            "forbidden",
            "Inspektur yang ditugaskan tidak dapat memulai peninjauan catatannya sendiri.",
        )

    previous = inspection.status
    inspection.status = "under_review"
    inspection.version += 1
    await record_audit(
        db,
        action="inspection.review_started",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={
            "reference": inspection.reference,
            "previous_status": previous,
            "version": inspection.version,
        },
    )
    await db.commit()
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    return await _inspection_detail(db, inspection)


@router.post("/inspections/{inspection_id}/review", response_model=InspectionDetail)
async def review_inspection(
    inspection_id: uuid.UUID,
    payload: InspectionReviewCreate,
    ctx: AuthContext = Depends(require_permission("review:decide")),
    db: AsyncSession = Depends(get_db),
) -> InspectionDetail:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    if inspection.status not in DECIDABLE_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Keputusan peninjauan hanya dapat dicatat untuk inspeksi yang dikirim, "
            "telah diproses AI, atau sedang ditinjau.",
        )
    if inspection.inspector_id == ctx.user.id:
        raise AppError(
            403,
            "forbidden",
            "Inspektur yang ditugaskan tidak dapat mencatat keputusan peninjauan untuk "
            "catatan ini.",
        )
    if payload.version is not None and payload.version != inspection.version:
        raise AppError(
            409, "conflict", "Inspeksi ini diubah oleh sesi lain. Muat ulang lalu coba lagi."
        )

    decision = payload.decision
    inspection.status = REVIEW_DECISION_STATUSES[decision]
    inspection.version += 1
    review = InspectionReview(
        inspection_id=inspection.id,
        reviewer_id=ctx.user.id,
        decision=decision,
        notes=payload.notes.strip(),
        created_at=datetime.now(UTC),
    )
    db.add(review)
    await record_audit(
        db,
        action=f"inspection.review_{decision}",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={
            "reference": inspection.reference,
            "decision": decision,
            "new_status": inspection.status,
            "version": inspection.version,
        },
    )
    await db.commit()
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    return await _inspection_detail(db, inspection)


@router.post("/inspections/{inspection_id}/reopen", response_model=InspectionOut)
async def reopen_inspection(
    inspection_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("inspections:manage")),
    db: AsyncSession = Depends(get_db),
) -> InspectionOut:
    inspection = await _get_accessible_inspection(db, ctx, inspection_id)
    if inspection.status not in REOPENABLE_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya inspeksi yang telah ditinjau atau tidak dapat disimpulkan yang "
            "dapat dibuka kembali.",
        )

    previous = inspection.status
    inspection.status = "draft"
    inspection.version += 1
    await record_audit(
        db,
        action="inspection.reopened",
        actor=ctx.user,
        target_type="inspection",
        target_id=inspection.id,
        scope_id=inspection.scope_id,
        metadata={
            "reference": inspection.reference,
            "previous_status": previous,
            "version": inspection.version,
        },
    )
    await db.commit()
    return _inspection_out(await _get_accessible_inspection(db, ctx, inspection_id))
