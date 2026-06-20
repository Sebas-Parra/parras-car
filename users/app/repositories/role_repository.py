from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.role import Role


def get_by_id(db: Session, role_id: UUID) -> Role | None:
    return db.get(Role, role_id)


def get_by_ids(db: Session, role_ids: list[UUID]) -> list[Role]:
    return db.query(Role).filter(Role.id.in_(role_ids)).all()


def get_by_name(db: Session, name: str) -> Role | None:
    return db.query(Role).filter(Role.name == name).first()


def list_all(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.name).all()


def create(db: Session, name: str, description: str | None) -> Role:
    role = Role(name=name, description=description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def delete(db: Session, role: Role) -> None:
    db.delete(role)
    db.commit()
