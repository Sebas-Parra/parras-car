from sqlalchemy import Column, DateTime, ForeignKey, Integer, func

from app.db.base import Base


class UserRole(Base):
    __tablename__ = "user_roles"

    id_user = Column(Integer, ForeignKey("users.id_person"), primary_key=True)
    id_role = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    assigned_at = Column(DateTime, nullable=False, server_default=func.now())
