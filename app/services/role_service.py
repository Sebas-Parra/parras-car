from sqlalchemy.orm import Session

from app.models.role import Role


def list_roles(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.id).all()
