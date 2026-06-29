from collections.abc import Generator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.base import SessionLocal
from app.utils.security import decode_token

_bearer = HTTPBearer(auto_error=False)

_ADMIN_ROLES = {"admin", "root"}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Se requiere token de acceso.",
        )
    try:
        return decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not _ADMIN_ROLES & set(current_user.get("roles", [])):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol admin o root.",
        )
    return current_user


def require_root(current_user: dict = Depends(get_current_user)) -> dict:
    if "root" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol root.",
        )
    return current_user


def require_self_or_admin(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Permite acceso si el token pertenece al recurso solicitado O si tiene rol admin/root."""
    # Works for both /{person_id} and /{user_id} path params
    resource_id = request.path_params.get("person_id") or request.path_params.get("user_id")
    if resource_id and str(resource_id) != current_user.get("sub") and not _ADMIN_ROLES & set(current_user.get("roles", [])):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo puedes acceder a tus propios datos.",
        )
    return current_user
