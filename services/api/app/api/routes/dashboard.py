from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AuthContext, require_permission
from app.core.inspection_workflow import INSPECTION_STATUSES
from app.core.maintenance_workflow import (
    ACTIVE_WORK_ORDER_STATUSES,
    FINDING_STATUSES,
    WORK_ORDER_STATUSES,
)
from app.db.session import get_db
from app.models.identity import Scope
from app.models.inspections import Inspection
from app.models.maintenance import Finding, WorkOrder
from app.schemas.common import AssetBrief
from app.schemas.dashboard import (
    DashboardFindings,
    DashboardInspections,
    DashboardOverviewOut,
    DashboardWorkOrders,
    RecentInspectionItem,
    TrendPoint,
)
from app.services.access import accessible_scope_condition

router = APIRouter(tags=["dashboard"])

JAKARTA = ZoneInfo("Asia/Jakarta")
MONTH_LABELS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
)
OPEN_FINDING_STATUSES = frozenset(
    {"confirmed", "assigned", "in_progress", "awaiting_verification"}
)
OVERDUE_AFTER_DAYS = 14
TREND_MONTHS = 6


async def _status_counts(
    db: AsyncSession, model: Any, scope_path: str
) -> dict[str, int]:
    rows = (
        await db.execute(
            select(model.status, func.count())
            .join(Scope, model.scope_id == Scope.id)
            .where(accessible_scope_condition(scope_path))
            .group_by(model.status)
        )
    ).all()
    return {status: count for status, count in rows}


def _filled_counts(raw: dict[str, int], statuses: tuple[str, ...]) -> dict[str, int]:
    return {status: raw.get(status, 0) for status in statuses}


def _month_starts(now_local: datetime) -> list[datetime]:
    current = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    months: list[datetime] = []
    for offset in range(TREND_MONTHS):
        if offset:
            current = (current - timedelta(days=1)).replace(day=1)
        months.append(current)
    return list(reversed(months))


@router.get("/dashboard/overview", response_model=DashboardOverviewOut)
async def dashboard_overview(
    ctx: AuthContext = Depends(require_permission("dashboard:read")),
    db: AsyncSession = Depends(get_db),
) -> DashboardOverviewOut:
    now_local = datetime.now(JAKARTA)
    month_starts = _month_starts(now_local)
    first_month_utc = month_starts[0].astimezone(UTC)
    current_month_utc = month_starts[-1].astimezone(UTC)

    inspection_counts = _filled_counts(
        await _status_counts(db, Inspection, ctx.scope_path), INSPECTION_STATUSES
    )
    this_month = (
        await db.execute(
            select(func.count())
            .select_from(Inspection)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(
                accessible_scope_condition(ctx.scope_path),
                Inspection.inspected_at >= current_month_utc,
            )
        )
    ).scalar_one()

    trend_rows = (
        await db.execute(
            select(Inspection.inspected_at)
            .join(Scope, Inspection.scope_id == Scope.id)
            .where(
                accessible_scope_condition(ctx.scope_path),
                Inspection.inspected_at >= first_month_utc,
            )
        )
    ).all()
    trend_lookup: dict[tuple[int, int], int] = {}
    for (inspected_at,) in trend_rows:
        local = inspected_at
        if local.tzinfo is None:
            local = local.replace(tzinfo=UTC)
        local = local.astimezone(JAKARTA)
        key = (local.year, local.month)
        trend_lookup[key] = trend_lookup.get(key, 0) + 1
    inspection_trend = [
        TrendPoint(
            month=f"{start.year:04d}-{start.month:02d}",
            label=f"{MONTH_LABELS[start.month - 1]} {start.year}",
            count=trend_lookup.get((start.year, start.month), 0),
        )
        for start in month_starts
    ]

    finding_counts = _filled_counts(
        await _status_counts(db, Finding, ctx.scope_path), FINDING_STATUSES
    )
    open_findings = sum(
        finding_counts[status] for status in OPEN_FINDING_STATUSES
    )

    work_order_counts = _filled_counts(
        await _status_counts(db, WorkOrder, ctx.scope_path), WORK_ORDER_STATUSES
    )
    active_work_orders = sum(
        work_order_counts[status] for status in ACTIVE_WORK_ORDER_STATUSES
    )
    overdue_cutoff = datetime.now(UTC) - timedelta(days=OVERDUE_AFTER_DAYS)
    overdue_work_orders = (
        await db.execute(
            select(func.count())
            .select_from(WorkOrder)
            .join(Scope, WorkOrder.scope_id == Scope.id)
            .where(
                accessible_scope_condition(ctx.scope_path),
                WorkOrder.status.in_(tuple(ACTIVE_WORK_ORDER_STATUSES)),
                WorkOrder.created_at < overdue_cutoff,
            )
        )
    ).scalar_one()

    recent_rows = (
        await db.execute(
            select(Inspection)
            .join(Scope, Inspection.scope_id == Scope.id)
            .options(selectinload(Inspection.asset))
            .where(accessible_scope_condition(ctx.scope_path))
            .order_by(Inspection.inspected_at.desc())
            .limit(5)
        )
    ).scalars().all()

    return DashboardOverviewOut(
        generated_at=datetime.now(UTC),
        inspections=DashboardInspections(
            total=sum(inspection_counts.values()),
            this_month=this_month,
            awaiting_review=inspection_counts["under_review"],
            ai_processing=inspection_counts["ai_processing"],
            counts=inspection_counts,
        ),
        findings=DashboardFindings(
            total=sum(finding_counts.values()),
            open=open_findings,
            counts=finding_counts,
        ),
        work_orders=DashboardWorkOrders(
            total=sum(work_order_counts.values()),
            active=active_work_orders,
            overdue=overdue_work_orders,
            counts=work_order_counts,
        ),
        inspection_trend=inspection_trend,
        recent_inspections=[
            RecentInspectionItem(
                id=inspection.id,
                reference=inspection.reference,
                status=inspection.status,
                asset=AssetBrief.model_validate(inspection.asset),
                inspected_at=inspection.inspected_at,
            )
            for inspection in recent_rows
        ],
        overdue_after_days=OVERDUE_AFTER_DAYS,
    )
