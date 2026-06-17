from collections.abc import Generator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.base import SessionLocal
from app.entities.user import User
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None or not user.active or not user.person.active:
        raise credentials_exception
    return user


def require_role(role_name: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        role_names = {role.name for role in current_user.roles}
        if role_name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return checker


def require_self_or_admin_person(
    person_id: int,
    current_user: User = Depends(get_current_user),
) -> User:
    role_names = {role.name for role in current_user.roles}
    if current_user.id_person != person_id and "administrador" not in role_names:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user


def require_self_or_admin_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
) -> User:
    role_names = {role.name for role in current_user.roles}
    if current_user.id_person != user_id and "administrador" not in role_names:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user
