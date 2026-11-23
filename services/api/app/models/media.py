import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.identity import User

MEDIA_STATUSES = ("pending_upload", "ready", "quarantined")
AI_JOB_STATUSES = ("queued", "running", "succeeded", "failed")
AI_MODEL_STATUSES = ("candidate", "active", "retired")
AI_MODEL_APPROVAL_STATUSES = ("draft", "pending_approval", "approved", "rejected", "demo_only")
DATASET_STATUSES = ("draft", "pending_approval", "approved", "rejected")


class MediaObject(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "media_objects"

    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending_upload", index=True, nullable=False
    )
    bucket: Mapped[str] = mapped_column(String(64), nullable=False)
    object_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    quarantine_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("inspections.id", ondelete="RESTRICT"), index=True
    )
    scope_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("scopes.id", ondelete="RESTRICT"), index=True
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    uploaded_by: Mapped[User] = relationship(lazy="selectin")


class Dataset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "datasets"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(240), default="", nullable=False)
    license_note: Mapped[str] = mapped_column(String(240), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    class_names: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    split_train: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    split_validation: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    split_test: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True, nullable=False)
    approval_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    approved_by: Mapped[User | None] = relationship(lazy="selectin")


class AIModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_models"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    family: Mapped[str] = mapped_column(String(64), default="", index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    modality: Mapped[str] = mapped_column(String(24), default="image", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="candidate", nullable=False)
    approval_status: Mapped[str] = mapped_column(
        String(24), default="draft", index=True, nullable=False
    )
    dataset_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    class_names: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    training_config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    evaluation_metrics: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    evaluation_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    known_limitations: Mapped[str] = mapped_column(Text, default="", nullable=False)
    approval_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    approved_by: Mapped[User | None] = relationship(lazy="selectin")


class AIJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_jobs"

    status: Mapped[str] = mapped_column(String(16), default="queued", index=True, nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("inspections.id", ondelete="RESTRICT"), index=True
    )
    media_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("media_objects.id", ondelete="RESTRICT"), index=True
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("ai_models.id", ondelete="RESTRICT"), index=True
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    model: Mapped[AIModel] = relationship(lazy="selectin")
    requested_by: Mapped[User] = relationship(lazy="selectin")
