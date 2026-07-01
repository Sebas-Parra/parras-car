from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.refresh_token import RefreshToken


def create(db: Session, user_id: UUID, token: str, expires_at: datetime) -> RefreshToken:
    rt = RefreshToken(id_user=user_id, token=token, expires_at=expires_at)
    db.add(rt)
    db.flush()
    return rt


def get_by_token(db: Session, token: str) -> RefreshToken | None:
    return db.query(RefreshToken).filter(RefreshToken.token == token).first()


def revoke(db: Session, rt: RefreshToken) -> None:
    rt.revoked = True


def revoke_all_for_user(db: Session, user_id: UUID) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.id_user == user_id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True})
