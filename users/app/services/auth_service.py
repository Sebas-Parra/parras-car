from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.auth import LoginRequest, TokenResponse
from app.repositories import user_repository
from app.utils.security import create_access_token, verify_password


def login(db: Session, data: LoginRequest) -> TokenResponse:
    user = user_repository.get_by_username(db, data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al administrador.",
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    roles = [r.name for r in user.roles]
    token = create_access_token(str(user.id_person), user.username, roles)

    return TokenResponse(
        access_token=token,
        user_id=str(user.id_person),
        username=user.username,
        roles=roles,
    )
