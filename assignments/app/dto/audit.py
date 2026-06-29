from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.entities.assignment_audit import ActionType


class AuditRead(BaseModel):
    id: UUID
    user_id: UUID
    vehicle_id: UUID
    action: ActionType
    timestamp: datetime
    previous_data: dict | None = None
    new_data: dict | None = None

    model_config = {"from_attributes": True}
