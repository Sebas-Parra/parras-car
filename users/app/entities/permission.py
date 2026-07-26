import uuid

from sqlalchemy import Boolean, Column, String, Uuid
from sqlalchemy.orm import relationship

from app.db.base import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_public = Column(Boolean, nullable=False, default=False)

    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")
