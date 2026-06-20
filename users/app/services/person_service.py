from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.person import PersonUpdate
from app.dto.user import UserCreate
from app.entities.person import Person
from app.entities.user import User
from app.repositories import person_repository, role_repository, user_repository
from app.utils import username as username_util
from app.utils.security import hash_password


def get_person(db: Session, person_id: int) -> Person:
    person = person_repository.get_by_id(db, person_id)
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


def list_persons(db: Session, skip: int = 0, limit: int = 100) -> list[Person]:
    return person_repository.list_all(db, skip, limit)


def create_person_with_user(db: Session, data: UserCreate) -> Person:
    if person_repository.get_by_cedula(db, data.cedula):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cedula already registered")

    if person_repository.get_by_email(db, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"El correo '{data.email}' ya está registrado, por favor ingrese uno diferente")

    roles = role_repository.get_by_ids(db, data.role_ids)
    if len(roles) != len(set(data.role_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more roles not found")

    generated_username = username_util.generate_unique_username(
        data.first_name,
        data.middle_name,
        data.last_name,
        lambda u: user_repository.username_exists(db, u),
    )

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
        username=generated_username,
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
        if person_repository.get_by_email(db, update_data["email"]):
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
