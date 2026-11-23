import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_any_permission, require_permission
from app.core.errors import AppError
from app.core.maintenance_workflow import (
    ACTIVE_WORK_ORDER_STATUSES,
    CANCELLABLE_WORK_ORDER_STATUSES,
    EDITABLE_FINDING_STATUSES,
    FINDABLE_INSPECTION_STATUSES,
    FINDING_PRIORITIES,
    FINDING_STATUSES,
    REJECTABLE_FINDING_STATUSES,
    REOPENABLE_FINDING_STATUSES,
    SUPERSEDABLE_FINDING_STATUSES,
    WORK_ORDER_STATUSES,
)
from app.db.session import get_db
from app.models.identity import Scope, User
from app.models.inspections import Inspection
from app.models.maintenance import Finding, Notification, WorkOrder
from app.schemas.common import AssetBrief, InspectionBrief, Page, ScopeOut
from app.schemas.maintenance import (
    AssigneeOut,
    FindingBrief,
    FindingCreate,
    FindingDecision,
    FindingDetail,
    FindingOut,
    FindingSummaryOut,
    FindingUpdate,
    NotificationCountOut,
    NotificationOut,
    WorkOrderCreate,
    WorkOrderOut,
    WorkOrderSummaryOut,
    WorkOrderTransition,
    WorkOrderUpdate,
)
from app.services.access import accessible_scope_condition, can_access_scope, user_brief
from app.services.audit import record_audit
from app.services.notifications import (
    create_notifications,
    notify_permission_holders,
    users_with_permission,
)

router = APIRouter(tags=["maintenance"])

EDITABLE_WORK_ORDER_STATUSES = frozenset({"open", "in_progress"})

FINDING_STATUS_LABELS = {
    "confirmed": "terkonfirmasi",
    "assigned": "ditugaskan",
    "in_progress": "sedang dikerjakan",
    "awaiting_verification": "menunggu verifikasi",
    "closed": "selesai",
    "rejected": "ditolak",
}


def _new_reference(prefix: str) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return f"{prefix}-{stamp}-{secrets.token_hex(3).upper()}"


def _finding_out(finding: Finding) -> FindingOut:
    return FindingOut(
        id=finding.id,
        reference=finding.reference,
        title=finding.title,
        description=finding.description,
        priority=finding.priority,
        status=finding.status,
        resolution_notes=finding.resolution_notes,
        version=finding.version,
        inspection=InspectionBrief.model_validate(finding.inspection),
        asset=AssetBrief.model_validate(finding.asset),
        scope=ScopeOut.model_validate(finding.scope),
        created_by=user_brief(finding.created_by),
        closed_at=finding.closed_at,
        created_at=finding.created_at,
        updated_at=finding.updated_at,
    )


def _work_order_out(work_order: WorkOrder) -> WorkOrderOut:
    return WorkOrderOut(
        id=work_order.id,
        reference=work_order.reference,
        title=work_order.title,
        instructions=work_order.instructions,
        status=work_order.status,
        completion_notes=work_order.completion_notes,
        verification_notes=work_order.verification_notes,
        version=work_order.version,
        finding=FindingBrief(
            id=work_order.finding.id,
            reference=work_order.finding.reference,
            title=work_order.finding.title,
            status=work_order.finding.status,
            priority=work_order.finding.priority,
        ),
        asset=AssetBrief.model_validate(work_order.finding.asset),
        scope=ScopeOut.model_validate(work_order.scope),
        assignee=user_brief(work_order.assignee),
        created_by=user_brief(work_order.created_by),
        completed_at=work_order.completed_at,
        verified_at=work_order.verified_at,
        created_at=work_order.created_at,
        updated_at=work_order.updated_at,
    )


async def _get_accessible_finding(
    db: AsyncSession, ctx: AuthContext, finding_id: uuid.UUID
) -> Finding:
    stmt = (
        select(Finding)
        .join(Scope, Finding.scope_id == Scope.id)
        .where(Finding.id == finding_id, accessible_scope_condition(ctx.scope_path))
    )
    finding = (await db.execute(stmt)).scalar_one_or_none()
    if finding is None:
        raise AppError(404, "not_found", "Temuan tidak ditemukan.")
    return finding


async def _get_accessible_work_order(
    db: AsyncSession, ctx: AuthContext, work_order_id: uuid.UUID
) -> WorkOrder:
    stmt = (
        select(WorkOrder)
        .join(Scope, WorkOrder.scope_id == Scope.id)
        .where(WorkOrder.id == work_order_id, accessible_scope_condition(ctx.scope_path))
    )
    work_order = (await db.execute(stmt)).scalar_one_or_none()
    if work_order is None:
        raise AppError(404, "not_found", "Perintah kerja tidak ditemukan.")
    return work_order


async def _work_orders_for_finding(db: AsyncSession, finding_id: uuid.UUID) -> list[WorkOrder]:
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.finding_id == finding_id)
        .order_by(WorkOrder.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def _active_work_orders(db: AsyncSession, finding_id: uuid.UUID) -> list[WorkOrder]:
    stmt = select(WorkOrder).where(
        WorkOrder.finding_id == finding_id,
        WorkOrder.status.in_(tuple(ACTIVE_WORK_ORDER_STATUSES)),
    )
    return list((await db.execute(stmt)).scalars().all())


async def _get_assignee(
    db: AsyncSession, ctx: AuthContext, assignee_id: uuid.UUID, finding_scope_path: str
) -> User:
    stmt = (
        select(User)
        .join(Scope, User.scope_id == Scope.id)
        .where(
            User.id == assignee_id,
            User.is_active.is_(True),
            accessible_scope_condition(ctx.scope_path),
        )
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not can_access_scope(finding_scope_path, user.scope.path):
        raise AppError(404, "not_found", "Penerima tugas tidak ditemukan.")
    return user


def _recompute_finding_status(finding: Finding, active: list[WorkOrder]) -> bool:
    """Set the derived finding status from its active work orders."""
    if finding.status in SUPERSEDABLE_FINDING_STATUSES:
        return False
    if not active:
        target = "confirmed"
    elif any(order.status == "in_progress" for order in active):
        target = "in_progress"
    elif any(order.status == "open" for order in active):
        target = "assigned"
    else:
        target = "awaiting_verification"
    if finding.status == target:
        return False
    finding.status = target
    finding.version += 1
    return True


# --- Findings ---------------------------------------------------------------


@router.get("/findings", response_model=Page[FindingOut])
async def list_findings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None, max_length=24),
    priority: str | None = Query(default=None, max_length=16),
    asset_id: uuid.UUID | None = Query(default=None),
    inspection_id: uuid.UUID | None = Query(default=None),
    mine: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=120),
    ctx: AuthContext = Depends(require_permission("findings:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[FindingOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if status:
        conditions.append(Finding.status == status)
    if priority:
        conditions.append(Finding.priority == priority)
    if asset_id is not None:
        conditions.append(Finding.asset_id == asset_id)
    if inspection_id is not None:
        conditions.append(Finding.inspection_id == inspection_id)
    if mine:
        conditions.append(Finding.created_by_id == ctx.user.id)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(or_(Finding.reference.ilike(term), Finding.title.ilike(term)))

    total = (
        await db.execute(
            select(func.count())
            .select_from(Finding)
            .join(Scope, Finding.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(Finding)
        .join(Scope, Finding.scope_id == Scope.id)
        .where(*conditions)
        .order_by(Finding.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    findings = (await db.execute(stmt)).scalars().all()
    return Page[FindingOut](
        items=[_finding_out(finding) for finding in findings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/findings/summary", response_model=FindingSummaryOut)
async def findings_summary(
    ctx: AuthContext = Depends(require_permission("findings:read")),
    db: AsyncSession = Depends(get_db),
) -> FindingSummaryOut:
    rows = (
        await db.execute(
            select(Finding.status, func.count())
            .join(Scope, Finding.scope_id == Scope.id)
            .where(accessible_scope_condition(ctx.scope_path))
            .group_by(Finding.status)
        )
    ).all()
    counts = {status: 0 for status in FINDING_STATUSES}
    for status, count in rows:
        counts[status] = count
    return FindingSummaryOut(total=sum(counts.values()), counts=counts)


@router.post("/findings", response_model=FindingOut, status_code=201)
async def create_finding(
    payload: FindingCreate,
    ctx: AuthContext = Depends(require_permission("findings:write")),
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    inspection = (
        await db.execute(
            select(Inspection)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(
                Inspection.id == payload.inspection_id,
                accessible_scope_condition(ctx.scope_path),
            )
        )
    ).scalar_one_or_none()
    if inspection is None:
        raise AppError(404, "not_found", "Inspeksi tidak ditemukan.")
    if inspection.status not in FINDABLE_INSPECTION_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Temuan hanya dapat dicatat untuk inspeksi yang telah ditinjau atau "
            "tidak dapat disimpulkan.",
        )
    if payload.priority not in FINDING_PRIORITIES:
        raise AppError(422, "validation_error", "Prioritas tidak didukung.")

    finding = Finding(
        reference=_new_reference("FND"),
        title=payload.title.strip(),
        description=payload.description.strip(),
        priority=payload.priority,
        status="confirmed",
        inspection_id=inspection.id,
        asset_id=inspection.asset_id,
        scope_id=inspection.scope_id,
        created_by_id=ctx.user.id,
    )
    db.add(finding)
    await db.flush()
    await record_audit(
        db,
        action="finding.created",
        actor=ctx.user,
        target_type="finding",
        target_id=finding.id,
        scope_id=finding.scope_id,
        metadata={
            "reference": finding.reference,
            "inspection": inspection.reference,
            "priority": finding.priority,
        },
    )
    await notify_permission_holders(
        db,
        permission_code="work_orders:write",
        scope_path=finding.scope.path,
        exclude_user_id=ctx.user.id,
        kind="finding.created",
        title=f"Temuan {finding.reference} dicatat",
        body=(
            f"Temuan terverifikasi manusia dicatat dari inspeksi "
            f"{inspection.reference}. Tinjau apakah perlu perintah kerja."
        ),
        target_type="finding",
        target_id=str(finding.id),
    )
    await db.commit()
    return _finding_out(await _get_accessible_finding(db, ctx, finding.id))


@router.get("/findings/{finding_id}", response_model=FindingDetail)
async def get_finding(
    finding_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("findings:read")),
    db: AsyncSession = Depends(get_db),
) -> FindingDetail:
    finding = await _get_accessible_finding(db, ctx, finding_id)
    work_orders = await _work_orders_for_finding(db, finding.id)
    return FindingDetail(
        **_finding_out(finding).model_dump(),
        work_orders=[_work_order_out(order) for order in work_orders],
    )


@router.patch("/findings/{finding_id}", response_model=FindingOut)
async def update_finding(
    finding_id: uuid.UUID,
    payload: FindingUpdate,
    ctx: AuthContext = Depends(require_permission("findings:write")),
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    finding = await _get_accessible_finding(db, ctx, finding_id)
    if finding.status not in EDITABLE_FINDING_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya temuan terkonfirmasi yang tidak sedang dalam tindakan perbaikan "
            "yang dapat diubah.",
        )
    if payload.version is not None and payload.version != finding.version:
        raise AppError(
            409, "conflict", "Temuan ini diubah oleh sesi lain. Muat ulang lalu coba lagi."
        )
    if payload.priority is not None and payload.priority not in FINDING_PRIORITIES:
        raise AppError(422, "validation_error", "Prioritas tidak didukung.")

    changed: list[str] = []
    if payload.title is not None:
        finding.title = payload.title.strip()
        changed.append("title")
    if payload.description is not None:
        finding.description = payload.description.strip()
        changed.append("description")
    if payload.priority is not None:
        finding.priority = payload.priority
        changed.append("priority")
    if not changed:
        return _finding_out(finding)

    finding.version += 1
    await record_audit(
        db,
        action="finding.updated",
        actor=ctx.user,
        target_type="finding",
        target_id=finding.id,
        scope_id=finding.scope_id,
        metadata={"reference": finding.reference, "fields": changed, "version": finding.version},
    )
    await db.commit()
    return _finding_out(await _get_accessible_finding(db, ctx, finding_id))


@router.post("/findings/{finding_id}/reject", response_model=FindingOut)
async def reject_finding(
    finding_id: uuid.UUID,
    payload: FindingDecision,
    ctx: AuthContext = Depends(require_permission("findings:write")),
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    finding = await _get_accessible_finding(db, ctx, finding_id)
    if finding.status not in REJECTABLE_FINDING_STATUSES:
        raise AppError(409, "conflict", "Hanya temuan terkonfirmasi yang dapat ditolak.")
    active = await _active_work_orders(db, finding.id)
    if active:
        raise AppError(
            409, "conflict", "Batalkan perintah kerja yang aktif sebelum menolak temuan ini."
        )

    finding.status = "rejected"
    finding.version += 1
    finding.resolution_notes = payload.notes.strip()
    await record_audit(
        db,
        action="finding.rejected",
        actor=ctx.user,
        target_type="finding",
        target_id=finding.id,
        scope_id=finding.scope_id,
        metadata={
            "reference": finding.reference,
            "new_status": finding.status,
            "version": finding.version,
        },
    )
    if finding.created_by_id != ctx.user.id:
        await create_notifications(
            db,
            user_ids=[finding.created_by_id],
            kind="finding.rejected",
            title=f"Temuan {finding.reference} ditolak",
            body="Peninjau menolak temuan yang tercatat. Buka temuan untuk membaca alasannya.",
            target_type="finding",
            target_id=str(finding.id),
        )
    await db.commit()
    return _finding_out(await _get_accessible_finding(db, ctx, finding_id))


@router.post("/findings/{finding_id}/reopen", response_model=FindingOut)
async def reopen_finding(
    finding_id: uuid.UUID,
    payload: FindingDecision,
    ctx: AuthContext = Depends(require_permission("findings:write")),
    db: AsyncSession = Depends(get_db),
) -> FindingOut:
    finding = await _get_accessible_finding(db, ctx, finding_id)
    if finding.status not in REOPENABLE_FINDING_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya temuan selesai atau ditolak yang dapat dibuka kembali.",
        )

    previous = finding.status
    finding.status = "confirmed"
    finding.version += 1
    finding.closed_at = None
    finding.resolution_notes = payload.notes.strip()
    await record_audit(
        db,
        action="finding.reopened",
        actor=ctx.user,
        target_type="finding",
        target_id=finding.id,
        scope_id=finding.scope_id,
        metadata={
            "reference": finding.reference,
            "previous_status": previous,
            "new_status": finding.status,
            "version": finding.version,
        },
    )
    await create_notifications(
        db,
        user_ids=[finding.created_by_id],
        kind="finding.reopened",
        title=f"Temuan {finding.reference} dibuka kembali",
        body="Peninjau membuka kembali temuan ini. Buka untuk meninjau alasan yang tercatat.",
        target_type="finding",
        target_id=str(finding.id),
    )
    await db.commit()
    return _finding_out(await _get_accessible_finding(db, ctx, finding_id))


# --- Work orders ------------------------------------------------------------


@router.get("/work-orders", response_model=Page[WorkOrderOut])
async def list_work_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None, max_length=24),
    finding_id: uuid.UUID | None = Query(default=None),
    assignee_id: uuid.UUID | None = Query(default=None),
    mine: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=120),
    ctx: AuthContext = Depends(require_permission("work_orders:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[WorkOrderOut]:
    conditions = [accessible_scope_condition(ctx.scope_path)]
    if status:
        conditions.append(WorkOrder.status == status)
    if finding_id is not None:
        conditions.append(WorkOrder.finding_id == finding_id)
    if assignee_id is not None:
        conditions.append(WorkOrder.assignee_id == assignee_id)
    if mine:
        conditions.append(WorkOrder.assignee_id == ctx.user.id)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(WorkOrder.reference.ilike(term), WorkOrder.title.ilike(term))
        )

    total = (
        await db.execute(
            select(func.count())
            .select_from(WorkOrder)
            .join(Scope, WorkOrder.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(WorkOrder)
        .join(Scope, WorkOrder.scope_id == Scope.id)
        .where(*conditions)
        .order_by(WorkOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    work_orders = (await db.execute(stmt)).scalars().all()
    return Page[WorkOrderOut](
        items=[_work_order_out(order) for order in work_orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/work-orders/summary", response_model=WorkOrderSummaryOut)
async def work_orders_summary(
    ctx: AuthContext = Depends(require_permission("work_orders:read")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderSummaryOut:
    rows = (
        await db.execute(
            select(WorkOrder.status, func.count())
            .join(Scope, WorkOrder.scope_id == Scope.id)
            .where(accessible_scope_condition(ctx.scope_path))
            .group_by(WorkOrder.status)
        )
    ).all()
    counts = {status: 0 for status in WORK_ORDER_STATUSES}
    for status, count in rows:
        counts[status] = count
    return WorkOrderSummaryOut(total=sum(counts.values()), counts=counts)


@router.get("/work-orders/assignees", response_model=list[AssigneeOut])
async def list_assignees(
    ctx: AuthContext = Depends(require_permission("work_orders:write")),
    db: AsyncSession = Depends(get_db),
) -> list[AssigneeOut]:
    user_ids = await users_with_permission(
        db,
        permission_code="work_orders:read",
        scope_path=ctx.scope_path,
        direction="down",
    )
    if not user_ids:
        return []
    rows = (
        await db.execute(
            select(User)
            .join(Scope, User.scope_id == Scope.id)
            .where(User.id.in_(user_ids))
            .order_by(User.full_name)
        )
    ).scalars().all()
    return [
        AssigneeOut(
            id=user.id,
            full_name=user.full_name,
            scope=ScopeOut.model_validate(user.scope),
        )
        for user in rows
    ]


@router.post("/work-orders", response_model=WorkOrderOut, status_code=201)
async def create_work_order(
    payload: WorkOrderCreate,
    ctx: AuthContext = Depends(require_permission("work_orders:write")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    finding = await _get_accessible_finding(db, ctx, payload.finding_id)
    if finding.status in SUPERSEDABLE_FINDING_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Perintah kerja tidak dapat dibuat untuk temuan yang selesai atau ditolak.",
        )
    assignee = await _get_assignee(db, ctx, payload.assignee_id, finding.scope.path)

    work_order = WorkOrder(
        reference=_new_reference("WO"),
        title=payload.title.strip(),
        instructions=payload.instructions.strip(),
        status="open",
        finding_id=finding.id,
        scope_id=finding.scope_id,
        assignee_id=assignee.id,
        created_by_id=ctx.user.id,
    )
    db.add(work_order)
    await db.flush()

    active = await _active_work_orders(db, finding.id)
    _recompute_finding_status(finding, active)

    await record_audit(
        db,
        action="work_order.created",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={
            "reference": work_order.reference,
            "finding": finding.reference,
            "assignee": str(assignee.id),
        },
    )
    await create_notifications(
        db,
        user_ids=[assignee.id],
        kind="work_order.assigned",
        title=f"Perintah kerja {work_order.reference} ditugaskan",
        body=(
            f"Anda ditugaskan perintah kerja tindakan perbaikan yang terkait dengan temuan "
            f"{finding.reference}. Ini pelacakan saran, bukan instruksi keselamatan."
        ),
        target_type="work_order",
        target_id=str(work_order.id),
    )
    await db.commit()
    work_order = await _get_accessible_work_order(db, ctx, work_order.id)
    return _work_order_out(work_order)


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(
    work_order_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("work_orders:read")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderOut)
async def update_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderUpdate,
    ctx: AuthContext = Depends(require_permission("work_orders:write")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    work_order = await _get_accessible_work_order(db, ctx, work_order_id)
    if work_order.status not in EDITABLE_WORK_ORDER_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya perintah kerja terbuka atau sedang dikerjakan yang dapat diubah.",
        )
    if payload.version is not None and payload.version != work_order.version:
        raise AppError(
            409, "conflict", "Perintah kerja ini diubah oleh sesi lain. Muat ulang lalu coba lagi."
        )

    changed: list[str] = []
    previous_assignee_id = work_order.assignee_id
    if payload.assignee_id is not None and payload.assignee_id != work_order.assignee_id:
        assignee = await _get_assignee(
            db, ctx, payload.assignee_id, work_order.finding.scope.path
        )
        work_order.assignee_id = assignee.id
        changed.append("assignee")
    if payload.title is not None:
        work_order.title = payload.title.strip()
        changed.append("title")
    if payload.instructions is not None:
        work_order.instructions = payload.instructions.strip()
        changed.append("instructions")
    if not changed:
        return _work_order_out(work_order)

    work_order.version += 1
    await record_audit(
        db,
        action="work_order.updated",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={
            "reference": work_order.reference,
            "fields": changed,
            "version": work_order.version,
        },
    )
    if "assignee" in changed and work_order.assignee_id != previous_assignee_id:
        await create_notifications(
            db,
            user_ids=[work_order.assignee_id],
            kind="work_order.reassigned",
            title=f"Perintah kerja {work_order.reference} dialihkan kepada Anda",
            body="Buka perintah kerja untuk meninjau instruksi dan status terkini.",
            target_type="work_order",
            target_id=str(work_order.id),
        )
    await db.commit()
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


def _assert_can_act_on_work_order(ctx: AuthContext, work_order: WorkOrder) -> None:
    if work_order.assignee_id != ctx.user.id and not ctx.has("work_orders:write"):
        raise AppError(
            403,
            "forbidden",
            "Hanya penerima tugas atau pengelola perintah kerja yang dapat melakukan tindakan ini.",
        )


@router.post("/work-orders/{work_order_id}/start", response_model=WorkOrderOut)
async def start_work_order(
    work_order_id: uuid.UUID,
    ctx: AuthContext = Depends(require_any_permission("work_orders:read")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    work_order = await _get_accessible_work_order(db, ctx, work_order_id)
    _assert_can_act_on_work_order(ctx, work_order)
    if work_order.status != "open":
        raise AppError(409, "conflict", "Hanya perintah kerja terbuka yang dapat dimulai.")
    work_order.status = "in_progress"
    work_order.version += 1
    await db.flush()
    active = await _active_work_orders(db, work_order.finding_id)
    _recompute_finding_status(work_order.finding, active)
    await record_audit(
        db,
        action="work_order.started",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={"reference": work_order.reference, "version": work_order.version},
    )
    await db.commit()
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


@router.post("/work-orders/{work_order_id}/complete", response_model=WorkOrderOut)
async def complete_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderTransition,
    ctx: AuthContext = Depends(require_any_permission("work_orders:read")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    work_order = await _get_accessible_work_order(db, ctx, work_order_id)
    _assert_can_act_on_work_order(ctx, work_order)
    if work_order.status not in EDITABLE_WORK_ORDER_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya perintah kerja terbuka atau sedang dikerjakan yang dapat "
            "dilaporkan selesai.",
        )
    work_order.status = "awaiting_verification"
    work_order.completion_notes = payload.notes.strip()
    work_order.completed_at = datetime.now(UTC)
    work_order.version += 1
    await db.flush()
    active = await _active_work_orders(db, work_order.finding_id)
    _recompute_finding_status(work_order.finding, active)
    await record_audit(
        db,
        action="work_order.completed",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={"reference": work_order.reference, "version": work_order.version},
    )
    await notify_permission_holders(
        db,
        permission_code="work_orders:verify",
        scope_path=work_order.scope.path,
        exclude_user_id=ctx.user.id,
        kind="work_order.awaiting_verification",
        title=f"Perintah kerja {work_order.reference} menunggu verifikasi",
        body=(
            f"Penerima tugas melaporkan penyelesaian perintah kerja yang terkait dengan temuan "
            f"{work_order.finding.reference}. Verifikasi independen diperlukan."
        ),
        target_type="work_order",
        target_id=str(work_order.id),
    )
    await db.commit()
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


@router.post("/work-orders/{work_order_id}/verify", response_model=WorkOrderOut)
async def verify_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderTransition,
    ctx: AuthContext = Depends(require_permission("work_orders:verify")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    work_order = await _get_accessible_work_order(db, ctx, work_order_id)
    if work_order.status != "awaiting_verification":
        raise AppError(
            409,
            "conflict",
            "Hanya perintah kerja yang menunggu verifikasi yang dapat diverifikasi.",
        )
    if work_order.assignee_id == ctx.user.id and not ctx.has("work_orders:write"):
        raise AppError(
            403,
            "forbidden",
            "Penerima tugas tidak dapat memverifikasi penyelesaian sendiri tanpa "
            "peran pengelola perintah kerja.",
        )

    now = datetime.now(UTC)
    work_order.status = "completed"
    work_order.verification_notes = payload.notes.strip()
    work_order.verified_at = now
    work_order.version += 1
    await db.flush()
    finding = work_order.finding
    active = await _active_work_orders(db, finding.id)
    if active:
        _recompute_finding_status(finding, active)
    elif finding.status not in SUPERSEDABLE_FINDING_STATUSES:
        finding.status = "closed"
        finding.version += 1
        finding.closed_at = now

    await record_audit(
        db,
        action="work_order.verified",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={
            "reference": work_order.reference,
            "finding": finding.reference,
            "finding_status": finding.status,
            "version": work_order.version,
        },
    )
    recipients = {work_order.assignee_id, finding.created_by_id}
    recipients.discard(ctx.user.id)
    await create_notifications(
        db,
        user_ids=recipients,
        kind="work_order.verified",
        title=f"Perintah kerja {work_order.reference} terverifikasi",
        body=(
            f"Penyelesaian telah diverifikasi. Temuan {finding.reference} kini "
            f"{FINDING_STATUS_LABELS.get(finding.status, finding.status)}. "
            "Ini hanya pencatatan, bukan izin keselamatan."
        ),
        target_type="work_order",
        target_id=str(work_order.id),
    )
    await db.commit()
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


@router.post("/work-orders/{work_order_id}/cancel", response_model=WorkOrderOut)
async def cancel_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderTransition,
    ctx: AuthContext = Depends(require_permission("work_orders:write")),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    work_order = await _get_accessible_work_order(db, ctx, work_order_id)
    if work_order.status not in CANCELLABLE_WORK_ORDER_STATUSES:
        raise AppError(
            409,
            "conflict",
            "Hanya perintah kerja terbuka atau sedang dikerjakan yang dapat dibatalkan.",
        )
    work_order.status = "cancelled"
    work_order.completion_notes = payload.notes.strip()
    work_order.version += 1
    await db.flush()
    active = await _active_work_orders(db, work_order.finding_id)
    _recompute_finding_status(work_order.finding, active)
    await record_audit(
        db,
        action="work_order.cancelled",
        actor=ctx.user,
        target_type="work_order",
        target_id=work_order.id,
        scope_id=work_order.scope_id,
        metadata={"reference": work_order.reference, "version": work_order.version},
    )
    if work_order.assignee_id != ctx.user.id:
        await create_notifications(
            db,
            user_ids=[work_order.assignee_id],
            kind="work_order.cancelled",
            title=f"Perintah kerja {work_order.reference} dibatalkan",
            body=(
                "Pengelola perintah kerja membatalkan penugasan ini. "
                "Buka untuk membaca alasannya."
            ),
            target_type="work_order",
            target_id=str(work_order.id),
        )
    await db.commit()
    return _work_order_out(await _get_accessible_work_order(db, ctx, work_order_id))


# --- Notifications ----------------------------------------------------------


def _notification_out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        kind=notification.kind,
        title=notification.title,
        body=notification.body,
        target_type=notification.target_type,
        target_id=notification.target_id,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


@router.get("/notifications", response_model=Page[NotificationOut])
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    ctx: AuthContext = Depends(require_permission("notifications:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[NotificationOut]:
    conditions = [Notification.user_id == ctx.user.id]
    if unread_only:
        conditions.append(Notification.read_at.is_(None))
    total = (
        await db.execute(select(func.count()).select_from(Notification).where(*conditions))
    ).scalar_one()
    stmt = (
        select(Notification)
        .where(*conditions)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    notifications = (await db.execute(stmt)).scalars().all()
    return Page[NotificationOut](
        items=[_notification_out(notification) for notification in notifications],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/notifications/summary", response_model=NotificationCountOut)
async def notifications_summary(
    ctx: AuthContext = Depends(require_permission("notifications:read")),
    db: AsyncSession = Depends(get_db),
) -> NotificationCountOut:
    unread = (
        await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == ctx.user.id, Notification.read_at.is_(None))
        )
    ).scalar_one()
    return NotificationCountOut(unread=unread)


@router.post("/notifications/read-all", response_model=NotificationCountOut)
async def read_all_notifications(
    ctx: AuthContext = Depends(require_permission("notifications:read")),
    db: AsyncSession = Depends(get_db),
) -> NotificationCountOut:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == ctx.user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await db.commit()
    return NotificationCountOut(unread=0)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
async def read_notification(
    notification_id: uuid.UUID,
    ctx: AuthContext = Depends(require_permission("notifications:read")),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    notification = (
        await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == ctx.user.id,
            )
        )
    ).scalar_one_or_none()
    if notification is None:
        raise AppError(404, "not_found", "Notifikasi tidak ditemukan.")
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        await db.commit()
    return _notification_out(notification)
