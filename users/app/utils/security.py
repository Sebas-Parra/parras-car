import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, username: str, roles: list[str] = None) -> str:
    """
    Crea un JWT sin incluir roles (evita que el cliente pueda modificar permisos).
    Los roles deben ser verificados del lado del servidor consultando la BD.
    El parámetro 'roles' se ignora aquí pero se mantiene para compatibilidad.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "iss": settings.jwt_issuer,
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def generate_refresh_token() -> str:
    # 190 random bytes -> ~254 base64url chars, in the same order of magnitude
    # as an access token JWT (whose exact length varies with username/roles).
    return secrets.token_urlsafe(190)


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"verify_iss": False},
    )
