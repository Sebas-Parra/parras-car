from sqlalchemy import Boolean, Column, DateTime, Uuid, func

from app.db.base import Base


class VehicleAssignment(Base):
    __tablename__ = "vehicle_assignments"

    user_id = Column(Uuid, primary_key=True, nullable=False)
    vehicle_id = Column(Uuid, primary_key=True, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
