from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.role import RoleCreate, RoleUpdate
from app.entities.role import Role
from app.repositories import role_repository


def list_roles(db: Session) -> list[Role]:
    return role_repository.list_all(db)


def get_role(db: Session, role_id: UUID) -> Role:
    role = role_repository.get_by_id(db, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return role


def create_role(db: Session, data: RoleCreate) -> Role:
    if role_repository.get_by_name(db, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un rol con el nombre '{data.name}'",
        )
    return role_repository.create(db, data.name, data.description)


def update_role(db: Session, role_id: UUID, data: RoleUpdate) -> Role:
    role = get_role(db, role_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != role.name:
        if role_repository.get_by_name(db, update_data["name"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un rol con el nombre '{update_data['name']}'",
            )

    for field, value in update_data.items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: UUID) -> None:
    role = get_role(db, role_id)
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar un rol que tiene usuarios asignados",
        )
    role_repository.delete(db, role)
