import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.inspections import InspectionType

ChecklistResult = Literal["pass", "fail", "not_applicable"]
CHECKLIST_CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]*$"


class ChecklistItemCreate(BaseModel):
    code: str = Field(min_length=2, max_length=48, pattern=CHECKLIST_CODE_PATTERN)
    label: str = Field(min_length=3, max_length=200)
    position: int = Field(ge=1, le=200)
    is_required: bool = True


class ChecklistTemplateCreate(BaseModel):
    code: str = Field(min_length=2, max_length=48, pattern=CHECKLIST_CODE_PATTERN)
    name: str = Field(min_length=3, max_length=160)
    inspection_type: InspectionType
    is_active: bool = True
    items: list[ChecklistItemCreate] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _unique_items(self) -> "ChecklistTemplateCreate":
        codes = [item.code.upper() for item in self.items]
        positions = [item.position for item in self.items]
        if len(set(codes)) != len(codes):
            raise ValueError("Kode item checklist harus unik dalam satu template.")
        if len(set(positions)) != len(positions):
            raise ValueError("Posisi item checklist harus unik dalam satu template.")
        return self


class ChecklistTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=160)
    is_active: bool | None = None


class ChecklistTemplateItemOut(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    position: int
    is_required: bool


class ChecklistTemplateOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    inspection_type: str
    version: int
    is_active: bool
    items: list[ChecklistTemplateItemOut]
    created_at: datetime
    updated_at: datetime


__all__ = [
    "ChecklistItemCreate",
    "ChecklistResult",
    "ChecklistTemplateCreate",
    "ChecklistTemplateItemOut",
    "ChecklistTemplateOut",
    "ChecklistTemplateUpdate",
]
