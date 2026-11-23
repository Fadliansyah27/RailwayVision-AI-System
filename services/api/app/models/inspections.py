import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.assets import Asset
from app.models.common import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.identity import Scope, User


class Inspection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inspections"

    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True, nullable=False)
    inspection_type: Mapped[str] = mapped_column(
        String(24), default="routine", nullable=False
    )
    location_reference: Mapped[str] = mapped_column(
        String(200), default="", nullable=False
    )
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    asset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("assets.id", ondelete="RESTRICT"), index=True
    )
    inspector_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    scope_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("scopes.id", ondelete="RESTRICT"), index=True
    )

    asset: Mapped[Asset] = relationship(lazy="selectin")
    inspector: Mapped[User] = relationship(lazy="selectin")
    scope: Mapped[Scope] = relationship(lazy="selectin")


class InspectionReview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inspection_reviews"

    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("inspections.id", ondelete="RESTRICT"), index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    reviewer: Mapped[User] = relationship(lazy="selectin")
