import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, JSON, Uuid, func

from app.db.base import Base


class ActionType(str, enum.Enum):
    CREACION = "CREACION"
    MODIFICACION = "MODIFICACION"
    ELIMINACION = "ELIMINACION"


class AssignmentAudit(Base):
    __tablename__ = "assignment_audits"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, nullable=False)
    vehicle_id = Column(Uuid, nullable=False)
    action = Column(Enum(ActionType), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    previous_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
