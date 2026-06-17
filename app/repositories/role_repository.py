from sqlalchemy.orm import Session

from app.entities.role import Role


def get_by_id(db: Session, role_id: int) -> Role | None:
    return db.get(Role, role_id)


def get_by_ids(db: Session, role_ids: list[int]) -> list[Role]:
    return db.query(Role).filter(Role.id.in_(role_ids)).all()


def list_all(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.id).all()
