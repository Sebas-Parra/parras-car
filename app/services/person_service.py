import re
import unicodedata

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.person import Person
from app.models.role import Role
from app.models.user import User
from app.schemas.person import PersonUpdate
from app.schemas.user import UserCreate


def get_person(db: Session, person_id: int) -> Person:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


def list_persons(db: Session, skip: int = 0, limit: int = 100) -> list[Person]:
    return db.query(Person).order_by(Person.id).offset(skip).limit(limit).all()


def _normalize_username_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", without_accents.lower())


def _first_token(value: str) -> str:
    parts = value.split()
    return parts[0] if parts else ""


def _build_username_base(data: UserCreate) -> str:
    first_name = _normalize_username_part(_first_token(data.first_name))
    middle_name = _normalize_username_part(_first_token(data.middle_name))
    last_name = _normalize_username_part(_first_token(data.last_name))
    return f"{first_name[:1]}{middle_name[:1]}{last_name}"


def _generate_unique_username(db: Session, data: UserCreate) -> str:
    base_username = _build_username_base(data)
    username = base_username
    suffix = 1

    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{suffix}"
        suffix += 1

    return username


def create_person_with_user(db: Session, data: UserCreate) -> Person:
    if db.query(Person).filter(Person.cedula == data.cedula).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cedula already registered")
    if db.query(Person).filter(Person.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
    if len(roles) != len(set(data.role_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more roles not found")

    person = Person(
        cedula=data.cedula,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        nationality=data.nationality,
    )
    db.add(person)
    db.flush()

    user = User(
        id_person=person.id,
        username=_generate_unique_username(db, data),
        password_hash=hash_password(data.password),
    )
    user.roles = roles
    db.add(user)
    db.commit()
    db.refresh(person)
    return person


def update_person(db: Session, person_id: int, data: PersonUpdate) -> Person:
    person = get_person(db, person_id)
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != person.email:
        if db.query(Person).filter(Person.email == update_data["email"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    for field, value in update_data.items():
        setattr(person, field, value)

    db.commit()
    db.refresh(person)
    return person


def deactivate_person(db: Session, person_id: int) -> Person:
    person = get_person(db, person_id)
    if person.user is not None:
        person.user.active = False
    person.active = False
    db.commit()
    db.refresh(person)
    return person


def activate_person(db: Session, person_id: int) -> Person:
    person = get_person(db, person_id)
    person.active = True
    db.commit()
    db.refresh(person)
    return person
