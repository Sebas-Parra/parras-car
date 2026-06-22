from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.entities.person import Person


def get_by_id(db: Session, person_id: UUID) -> Person | None:
    return db.get(Person, person_id)


def get_by_cedula(db: Session, cedula: str) -> Person | None:
    return db.query(Person).filter(Person.cedula == cedula).first()


def get_by_email(db: Session, email: str) -> Person | None:
    return db.query(Person).filter(func.lower(Person.email) == email.lower()).first()


def list_all(db: Session, skip: int = 0, limit: int = 100) -> list[Person]:
    return db.query(Person).order_by(Person.id).offset(skip).limit(limit).all()
