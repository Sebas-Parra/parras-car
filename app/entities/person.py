import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Uuid, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    address = Column(String(255), nullable=True)
    nationality = Column(String(100), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="person", uselist=False, cascade="all, delete-orphan")
