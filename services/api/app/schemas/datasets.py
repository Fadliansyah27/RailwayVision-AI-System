import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import UserBrief


class DatasetOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    version: str
    source: str
    license_note: str
    description: str
    class_names: list[str]
    image_count: int
    split_train: int
    split_validation: int
    split_test: int
    status: str
    approval_notes: str
    approved_at: datetime | None
    approved_by: UserBrief | None
    created_at: datetime
    updated_at: datetime


class DatasetCreate(BaseModel):
    code: str = Field(
        min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$"
    )
    name: str = Field(min_length=3, max_length=160)
    version: str = Field(min_length=1, max_length=32)
    source: str = Field(min_length=3, max_length=240)
    license_note: str = Field(min_length=3, max_length=240)
    description: str = Field(default="", max_length=4000)
    class_names: list[str] = Field(default_factory=list, max_length=64)
    image_count: int = Field(default=0, ge=0)
    split_train: int = Field(default=0, ge=0)
    split_validation: int = Field(default=0, ge=0)
    split_test: int = Field(default=0, ge=0)


class ReviewNotes(BaseModel):
    notes: str = Field(min_length=5, max_length=2000)


__all__ = ["DatasetCreate", "DatasetOut", "ReviewNotes"]
