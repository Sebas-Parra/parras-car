from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.role import Role


def get_by_id(db: Session, role_id: UUID) -> Role | None:
    return db.get(Role, role_id)


def get_by_ids(db: Session, role_ids: list[UUID]) -> list[Role]:
    return db.query(Role).filter(Role.id.in_(role_ids)).all()


def list_all(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.id).all()
