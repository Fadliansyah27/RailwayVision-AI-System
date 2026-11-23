import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import AssetBrief


class TrendPoint(BaseModel):
    month: str
    label: str
    count: int


class DashboardInspections(BaseModel):
    total: int
    this_month: int
    awaiting_review: int
    ai_processing: int
    counts: dict[str, int]


class DashboardFindings(BaseModel):
    total: int
    open: int
    counts: dict[str, int]


class DashboardWorkOrders(BaseModel):
    total: int
    active: int
    overdue: int
    counts: dict[str, int]


class RecentInspectionItem(BaseModel):
    id: uuid.UUID
    reference: str
    status: str
    asset: AssetBrief
    inspected_at: datetime


class DashboardOverviewOut(BaseModel):
    generated_at: datetime
    inspections: DashboardInspections
    findings: DashboardFindings
    work_orders: DashboardWorkOrders
    inspection_trend: list[TrendPoint]
    recent_inspections: list[RecentInspectionItem]
    overdue_after_days: int


__all__ = [
    "DashboardFindings",
    "DashboardInspections",
    "DashboardOverviewOut",
    "DashboardWorkOrders",
    "RecentInspectionItem",
    "TrendPoint",
]
