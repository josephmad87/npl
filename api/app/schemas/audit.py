from datetime import datetime

from app.schemas.common import ORMModel


class AuditLogOut(ORMModel):
    id: int
    actor_user_id: int | None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: str
    summary: str | None
    created_at: datetime
