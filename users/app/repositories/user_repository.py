from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.user import User


def get_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def list_all(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).order_by(User.id_person).offset(skip).limit(limit).all()


def username_exists(db: Session, username: str) -> bool:
    return db.query(User).filter(User.username == username).first() is not None
