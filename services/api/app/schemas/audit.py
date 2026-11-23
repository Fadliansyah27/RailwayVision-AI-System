import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    actor_label: str | None
    target_type: str | None
    target_id: str | None
    scope_id: uuid.UUID | None
    outcome: str
    request_id: str | None
    event_metadata: dict | None
    created_at: datetime
