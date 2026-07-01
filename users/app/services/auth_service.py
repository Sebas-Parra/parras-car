from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.dto.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.repositories import refresh_token_repository, user_repository
from app.utils.security import create_access_token, generate_refresh_token, verify_password


def _build_response(db: Session, user) -> TokenResponse:
    roles = [r.name for r in user.roles]
    access_token = create_access_token(str(user.id_person), user.username, roles)

    rt_value = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    refresh_token_repository.create(db, user.id_person, rt_value, expires_at)

    return TokenResponse(
        access_token=access_token,
        refresh_token=rt_value,
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=str(user.id_person),
        username=user.username,
        roles=roles,
    )


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
    response = _build_response(db, user)
    db.commit()
    return response


def refresh(db: Session, data: RefreshRequest) -> TokenResponse:
    rt = refresh_token_repository.get_by_token(db, data.refresh_token)

    if not rt or rt.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o revocado.",
        )

    exp = rt.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expirado. Inicia sesión nuevamente.",
        )

    # Rotación: revocar el token usado antes de emitir uno nuevo
    refresh_token_repository.revoke(db, rt)

    user = user_repository.get_by_id(db, rt.id_user)
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo.",
        )

    response = _build_response(db, user)
    db.commit()
    return response


def logout(db: Session, data: LogoutRequest) -> None:
    rt = refresh_token_repository.get_by_token(db, data.refresh_token)
    if rt and not rt.revoked:
        refresh_token_repository.revoke(db, rt)
        db.commit()
