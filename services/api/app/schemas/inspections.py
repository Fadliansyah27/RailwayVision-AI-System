import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

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


class ChecklistEntryUpdate(BaseModel):
    item_code: str = Field(min_length=2, max_length=48)
    result: Literal["pass", "fail", "not_applicable"] | None = None
    notes: str = Field(default="", max_length=2000)


class InspectionChecklistUpdate(BaseModel):
    version: int | None = Field(default=None, ge=1)
    entries: list[ChecklistEntryUpdate] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _unique_entries(self) -> "InspectionChecklistUpdate":
        codes = [entry.item_code.upper() for entry in self.entries]
        if len(set(codes)) != len(codes):
            raise ValueError("Setiap item checklist hanya boleh diperbarui sekali per permintaan.")
        return self


class InspectionChecklistItemOut(BaseModel):
    item_code: str
    item_label: str
    position: int
    is_required: bool
    result: str | None
    notes: str
    recorded_by: UserBrief | None
    updated_at: datetime


class InspectionChecklistOut(BaseModel):
    template_id: uuid.UUID | None
    template_code: str | None
    template_name: str | None
    template_version: int | None
    total: int
    required_total: int
    answered: int
    required_unanswered: int
    items: list[InspectionChecklistItemOut]


class InspectionDetail(InspectionOut):
    media_count: int = 0
    pending_detections: int = 0
    reviews: list[InspectionReviewOut] = Field(default_factory=list)
    checklist: InspectionChecklistOut | None = None


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
    "ChecklistEntryUpdate",
    "InspectionBrief",
    "InspectionChecklistItemOut",
    "InspectionChecklistOut",
    "InspectionChecklistUpdate",
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
