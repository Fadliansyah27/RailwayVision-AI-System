import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import (
    AssetBrief,
    CategoryOut,
    InspectionBrief,
    LocationOut,
    ScopeOut,
)


class AssetCreate(BaseModel):
    code: str = Field(min_length=3, max_length=48, pattern=r"^[A-Z0-9][A-Z0-9_-]*$")
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    category_id: uuid.UUID
    location_id: uuid.UUID | None = None
    status: Literal["active", "out_of_service", "retired"] = "active"


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    status: Literal["active", "out_of_service", "retired"] | None = None


class AssetOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str
    status: str
    category: CategoryOut
    location: LocationOut | None
    scope: ScopeOut
    created_at: datetime
    updated_at: datetime


class AssetDetail(AssetOut):
    inspections: list[InspectionBrief]
    latest_inspection: InspectionBrief | None


class AssetListPage(BaseModel):
    items: list[AssetOut]
    total: int
    page: int
    page_size: int


class AssetSummaryOut(BaseModel):
    total: int
    active: int
    out_of_service: int
    retired: int


class CategoryCreate(BaseModel):
    code: str = Field(min_length=2, max_length=48, pattern=r"^[A-Z0-9][A-Z0-9_-]*$")
    name: str = Field(min_length=2, max_length=120)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class LocationCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[A-Z0-9][A-Z0-9_-]*$")
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    scope_id: uuid.UUID


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


class InspectionAssetBrief(AssetBrief):
    pass
