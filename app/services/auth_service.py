from datetime import datetime, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.user import User


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.active or not user.person.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user


def login(db: Session, username: str, password: str) -> dict:
    user = authenticate_user(db, username, password)
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    role_names = [role.name for role in user.roles]
    access_token = create_access_token(str(user.id_person), role_names)
    refresh_token = create_refresh_token(str(user.id_person))
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None or not user.active or not user.person.active:
        raise credentials_exception

    role_names = [role.name for role in user.roles]
    access_token = create_access_token(str(user.id_person), role_names)
    return {"access_token": access_token, "token_type": "bearer"}
