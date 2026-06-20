from sqlalchemy.orm import Session

from app.entities.role import Role
from app.repositories import role_repository


def list_roles(db: Session) -> list[Role]:
    return role_repository.list_all(db)
