import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import AssetBrief, InspectionBrief, ScopeOut, UserBrief

InspectionType = Literal["routine", "detailed", "follow_up", "emergency"]


class InspectionCreate(BaseModel):
    asset_id: uuid.UUID
    inspection_type: InspectionType = "routine"
    location_reference: str = Field(default="", max_length=200)
    inspected_at: datetime | None = None
    notes: str = Field(default="", max_length=4000)


class InspectionUpdate(BaseModel):
    inspection_type: InspectionType | None = None
    location_reference: str | None = Field(default=None, max_length=200)
    inspected_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)
    version: int | None = Field(default=None, ge=1)


class InspectionOut(BaseModel):
    id: uuid.UUID
    reference: str
    status: str
    inspection_type: str
    location_reference: str
    notes: str
    inspected_at: datetime
    version: int
    asset: AssetBrief
    inspector: UserBrief
    scope: ScopeOut
    created_at: datetime
    updated_at: datetime


class InspectionReviewCreate(BaseModel):
    decision: Literal["accepted", "returned", "inconclusive"]
    notes: str = Field(min_length=5, max_length=2000)
    version: int | None = Field(default=None, ge=1)


class InspectionReviewOut(BaseModel):
    id: uuid.UUID
    decision: str
    notes: str
    reviewer: UserBrief
    created_at: datetime


class InspectionDetail(InspectionOut):
    media_count: int = 0
    pending_detections: int = 0
    reviews: list[InspectionReviewOut] = Field(default_factory=list)


class InspectionListPage(BaseModel):
    items: list[InspectionOut]
    total: int
    page: int
    page_size: int


class InspectionSummaryOut(BaseModel):
    total: int
    counts: dict[str, int]


class InspectionHistoryEntry(BaseModel):
    id: uuid.UUID
    reference: str
    status: str
    inspected_at: datetime


__all__ = [
    "InspectionBrief",
    "InspectionCreate",
    "InspectionDetail",
    "InspectionHistoryEntry",
    "InspectionListPage",
    "InspectionOut",
    "InspectionReviewCreate",
    "InspectionReviewOut",
    "InspectionSummaryOut",
    "InspectionUpdate",
]
