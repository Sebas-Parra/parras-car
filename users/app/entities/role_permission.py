from sqlalchemy import Column, DateTime, ForeignKey, Uuid, func

from app.db.base import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id_role = Column(Uuid, ForeignKey("roles.id"), primary_key=True)
    id_permission = Column(Uuid, ForeignKey("permissions.id"), primary_key=True)
    assigned_at = Column(DateTime, nullable=False, server_default=func.now())
