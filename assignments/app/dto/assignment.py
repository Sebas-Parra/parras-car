from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    user_id: UUID
    vehicle_id: UUID


class AssignmentRead(BaseModel):
    user_id: UUID
    vehicle_id: UUID
    active: bool
    assigned_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VehicleDetail(BaseModel):
    id: str
    plate: str
    brand: str
    model: str
    color: str
    year: int
    clasification: str
    tipo: str | None = None


class FleetResponse(BaseModel):
    user_id: UUID
    total: int
    vehicles: list[VehicleDetail]
