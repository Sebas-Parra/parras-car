from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.entities.permission import Permission
from app.entities.role import Role


def get_by_id(db: Session, role_id: UUID) -> Role | None:
    return db.get(Role, role_id)


def get_by_ids(db: Session, role_ids: list[UUID]) -> list[Role]:
    return db.query(Role).filter(Role.id.in_(role_ids)).all()


def get_by_name(db: Session, name: str) -> Role | None:
    return db.query(Role).filter(func.lower(Role.name) == name.lower()).first()


def list_all(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.name).all()


def create(db: Session, name: str, description: str | None, permissions: list[Permission]) -> Role:
    role = Role(name=name, description=description, permissions=permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def set_permissions(db: Session, role: Role, permissions: list[Permission]) -> Role:
    role.permissions = permissions
    db.commit()
    db.refresh(role)
    return role


def delete(db: Session, role: Role) -> None:
    db.delete(role)
    db.commit()
