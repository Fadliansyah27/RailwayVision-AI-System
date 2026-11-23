import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import UserBrief
from app.services.storage import ALLOWED_IMAGE_TYPES, is_sha256, safe_filename


class MediaIntent(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str
    size_bytes: int = Field(ge=1)
    sha256: str = Field(min_length=64, max_length=64)

    @field_validator("filename")
    @classmethod
    def clean_filename(cls, value: str) -> str:
        return safe_filename(value)

    @field_validator("content_type")
    @classmethod
    def allowed_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_IMAGE_TYPES:
            raise ValueError("Only JPEG, PNG, and WebP images are accepted")
        return normalized

    @field_validator("sha256")
    @classmethod
    def valid_sha256(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not is_sha256(normalized):
            raise ValueError("sha256 must be 64 lowercase hexadecimal characters")
        return normalized


class MediaOut(BaseModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    sha256: str | None
    status: str
    quarantine_reason: str | None
    uploaded_by: UserBrief
    uploaded_at: datetime | None
    created_at: datetime


class AIModelBrief(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    version: str


class AIModelOut(AIModelBrief):
    family: str
    modality: str
    description: str
    is_demo: bool
    status: str
    approval_status: str
    dataset_version: str | None
    checksum_sha256: str | None
    class_names: list[str]
    training_config: dict
    evaluation_metrics: dict | None
    evaluation_notes: str
    known_limitations: str
    approval_notes: str
    approved_at: datetime | None
    deployed_at: datetime | None
    retired_at: datetime | None
    usage_count: int = 0
    last_used_at: datetime | None = None
    created_at: datetime


class AIModelCreate(BaseModel):
    code: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    name: str = Field(min_length=3, max_length=160)
    version: str = Field(min_length=1, max_length=32)
    family: str = Field(default="", max_length=64)
    modality: str = Field(default="image", pattern=r"^image$")
    description: str = Field(default="", max_length=2000)
    is_demo: bool = False
    dataset_version: str | None = Field(default=None, max_length=64)
    checksum_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    class_names: list[str] = Field(default_factory=list, max_length=64)
    training_config: dict = Field(default_factory=dict)
    evaluation_metrics: dict | None = None
    evaluation_notes: str = Field(default="", max_length=4000)
    known_limitations: str = Field(default="", max_length=4000)


class AIJobCreate(BaseModel):
    media_id: uuid.UUID


class AIJobOut(BaseModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    media_id: uuid.UUID
    status: str
    error_code: str | None
    result: dict | None
    model: AIModelBrief
    requested_by: UserBrief
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
