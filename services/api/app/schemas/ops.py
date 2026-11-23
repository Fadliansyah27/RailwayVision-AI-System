import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import UserBrief
from app.schemas.media import AIModelBrief


class OpsAIJobOut(BaseModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    inspection_reference: str
    inspection_status: str
    media_id: uuid.UUID
    media_filename: str
    status: str
    error_code: str | None
    model: AIModelBrief
    requested_by: UserBrief
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class OpsLogEntry(BaseModel):
    ts: datetime
    level: str
    logger: str
    message: str
    request_id: str | None = None
    event: str | None = None
    method: str | None = None
    path: str | None = None
    status_code: int | None = None
    duration_ms: float | None = None
    outcome: str | None = None
    error_code: str | None = None
    exception: str | None = None


class OpsLogPage(BaseModel):
    items: list[OpsLogEntry]
    retained: int
    capacity: int
    generated_at: datetime
    note: str


class DeploymentCreate(BaseModel):
    version: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9._+-]+$")
    environment: Literal["local", "test", "staging", "production"]
    commit_sha: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{7,40}$")
    notes: str = Field(default="", max_length=1000)


class DeploymentRecordOut(BaseModel):
    id: uuid.UUID
    version: str
    environment: str
    commit_sha: str | None
    notes: str
    recorded_by: str
    recorded_at: datetime


class BackupStatusOut(BaseModel):
    status: str
    configured: bool
    checked_at: datetime
    last_backup_at: datetime | None = None
    age_hours: float | None = None
    size_bytes: int | None = None
    checksum_sha256: str | None = None
    last_restore_test_at: datetime | None = None
    max_age_hours: int
    detail: str


class DemoResetPreviewOut(BaseModel):
    enabled: bool
    environment: str
    confirmation_phrase: str
    scope_codes: list[str]
    counts: dict[str, int]
    total: int
    reason: str | None = None


class DemoResetRequest(BaseModel):
    confirm: str = Field(min_length=1, max_length=64)


class DemoResetResult(BaseModel):
    deleted: dict[str, int]
    total: int
    storage_cleanup: str
    storage_objects_deleted: int
    storage_failures: int
    completed_at: datetime
