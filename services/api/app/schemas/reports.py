import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import AssetBrief, UserBrief


class ReportTotals(BaseModel):
    inspections: int
    findings: int
    work_orders: int


class ReportInspectionRow(BaseModel):
    id: uuid.UUID
    reference: str
    status: str
    inspection_type: str
    asset: AssetBrief
    inspector: UserBrief
    inspected_at: datetime


class ReportSummaryOut(BaseModel):
    date_from: date
    date_to: date
    generated_at: datetime
    totals: ReportTotals
    inspection_counts: dict[str, int]
    finding_counts: dict[str, int]
    work_order_counts: dict[str, int]
    inspections: list[ReportInspectionRow]


__all__ = [
    "ReportInspectionRow",
    "ReportSummaryOut",
    "ReportTotals",
]
