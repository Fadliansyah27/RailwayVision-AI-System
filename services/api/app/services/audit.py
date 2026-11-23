import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import request_id_var
from app.models.identity import AuditEvent, User


async def record_audit(
    db: AsyncSession,
    *,
    action: str,
    actor: User | None = None,
    target_type: str | None = None,
    target_id: str | uuid.UUID | None = None,
    scope_id: uuid.UUID | None = None,
    outcome: str = "success",
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_user_id=actor.id if actor else None,
            actor_label=actor.email if actor else None,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            scope_id=scope_id if scope_id else (actor.scope_id if actor else None),
            outcome=outcome,
            request_id=request_id_var.get(),
            event_metadata=metadata or {},
        )
    )
