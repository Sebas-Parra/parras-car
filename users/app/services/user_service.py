from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.user import UserUpdate
from app.entities.user import User
from app.repositories import role_repository, user_repository


def get_user(db: Session, user_id: UUID) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return user_repository.list_all(db, skip, limit)


def update_user(db: Session, user_id: UUID, data: UserUpdate) -> User:
    user = get_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if "username" in update_data and update_data["username"] != user.username:
        if user_repository.get_by_username(db, update_data["username"]):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already registered")

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: UUID) -> User:
    user = get_user(db, user_id)
    user.active = False
    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, user_id: UUID) -> User:
    user = get_user(db, user_id)
    if not user.person.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot activate user while associated person is inactive",
        )
    user.active = True
    db.commit()
    db.refresh(user)
    return user


def assign_role(db: Session, user_id: UUID, role_id: UUID) -> User:
    user = get_user(db, user_id)
    role = role_repository.get_by_id(db, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role in user.roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already assigned")
    user.roles.append(role)
    db.commit()
    db.refresh(user)
    return user


def remove_role(db: Session, user_id: UUID, role_id: UUID) -> User:
    user = get_user(db, user_id)
    role = role_repository.get_by_id(db, role_id)
    if role is None or role not in user.roles:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not assigned to user")
    user.roles.remove(role)
    db.commit()
    db.refresh(user)
    return user
