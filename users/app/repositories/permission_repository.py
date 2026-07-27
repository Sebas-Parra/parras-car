from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.permission import Permission


def list_all(db: Session) -> list[Permission]:
    return db.query(Permission).order_by(Permission.name).all()


def list_public(db: Session) -> list[Permission]:
    return db.query(Permission).filter(Permission.is_public.is_(True)).all()


def get_by_ids(db: Session, permission_ids: list[UUID]) -> list[Permission]:
    return db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
