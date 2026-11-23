import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import (
    AssetBrief,
    InspectionBrief,
    ScopeOut,
    UserBrief,
)

Priority = Literal["low", "medium", "high"]


class FindingCreate(BaseModel):
    inspection_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    priority: Priority = "medium"


class FindingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    priority: Priority | None = None
    version: int | None = Field(default=None, ge=1)


class FindingDecision(BaseModel):
    notes: str = Field(min_length=5, max_length=2000)


class FindingBrief(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    status: str
    priority: str


class FindingOut(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    description: str
    priority: str
    status: str
    resolution_notes: str
    version: int
    inspection: InspectionBrief
    asset: AssetBrief
    scope: ScopeOut
    created_by: UserBrief
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkOrderCreate(BaseModel):
    finding_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    instructions: str = Field(default="", max_length=4000)
    assignee_id: uuid.UUID


class WorkOrderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    instructions: str | None = Field(default=None, max_length=4000)
    assignee_id: uuid.UUID | None = None
    version: int | None = Field(default=None, ge=1)


class WorkOrderTransition(BaseModel):
    notes: str = Field(min_length=5, max_length=2000)


class WorkOrderOut(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    instructions: str
    status: str
    completion_notes: str
    verification_notes: str
    version: int
    finding: FindingBrief
    asset: AssetBrief
    scope: ScopeOut
    assignee: UserBrief
    created_by: UserBrief
    completed_at: datetime | None
    verified_at: datetime | None
    created_at: datetime
    updated_at: datetime


class FindingDetail(FindingOut):
    work_orders: list[WorkOrderOut] = Field(default_factory=list)


class FindingSummaryOut(BaseModel):
    total: int
    counts: dict[str, int]


class WorkOrderSummaryOut(BaseModel):
    total: int
    counts: dict[str, int]


class AssigneeOut(BaseModel):
    id: uuid.UUID
    full_name: str
    scope: ScopeOut


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    target_type: str | None
    target_id: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationCountOut(BaseModel):
    unread: int


__all__ = [
    "AssigneeOut",
    "FindingBrief",
    "FindingCreate",
    "FindingDecision",
    "FindingDetail",
    "FindingOut",
    "FindingSummaryOut",
    "FindingUpdate",
    "NotificationCountOut",
    "NotificationOut",
    "WorkOrderCreate",
    "WorkOrderOut",
    "WorkOrderSummaryOut",
    "WorkOrderTransition",
    "WorkOrderUpdate",
]
