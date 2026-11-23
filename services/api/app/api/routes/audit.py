import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, require_permission
from app.db.session import get_db
from app.models.identity import AuditEvent, Scope
from app.schemas.audit import AuditEventOut
from app.schemas.common import Page
from app.services.access import accessible_scope_condition

router = APIRouter(tags=["audit"])


@router.get("/audit-events", response_model=Page[AuditEventOut])
async def list_audit_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    action: str | None = Query(default=None, max_length=80),
    target_type: str | None = Query(default=None, max_length=48),
    target_id: uuid.UUID | None = Query(default=None),
    ctx: AuthContext = Depends(require_permission("audit:read")),
    db: AsyncSession = Depends(get_db),
) -> Page[AuditEventOut]:
    conditions = [
        or_(
            AuditEvent.scope_id.is_(None),
            accessible_scope_condition(ctx.scope_path),
        )
    ]
    if action:
        conditions.append(AuditEvent.action == action)
    if target_type:
        conditions.append(AuditEvent.target_type == target_type)
    if target_id is not None:
        conditions.append(AuditEvent.target_id == str(target_id))

    total = (
        await db.execute(
            select(func.count())
            .select_from(AuditEvent)
            .outerjoin(Scope, AuditEvent.scope_id == Scope.id)
            .where(*conditions)
        )
    ).scalar_one()

    stmt = (
        select(AuditEvent)
        .outerjoin(Scope, AuditEvent.scope_id == Scope.id)
        .where(*conditions)
        .order_by(AuditEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    events = (await db.execute(stmt)).scalars().all()
    return Page[AuditEventOut](
        items=[AuditEventOut.model_validate(event) for event in events],
        total=total,
        page=page,
        page_size=page_size,
    )
