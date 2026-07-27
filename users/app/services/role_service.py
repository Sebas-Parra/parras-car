from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.role import RoleCreate, RoleUpdate
from app.entities.permission import Permission
from app.entities.role import Role
from app.repositories import permission_repository, role_repository


def list_roles(db: Session) -> list[Role]:
    return role_repository.list_all(db)


def get_role(db: Session, role_id: UUID) -> Role:
    role = role_repository.get_by_id(db, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return role


# Solo root puede otorgar la eliminación física de zonas/espacios a un rol.
ROOT_ONLY_PERMISSIONS = {"eliminar_zonas"}


def _resolve_permissions(db: Session, permission_ids: list[UUID], current_user: dict) -> list[Permission]:
    permissions = permission_repository.get_by_ids(db, permission_ids)
    found_ids = {p.id for p in permissions}
    missing = set(permission_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Permisos no encontrados: {', '.join(str(m) for m in missing)}",
        )
    if "root" not in (current_user.get("roles") or []):
        blocked = [p.name for p in permissions if p.name in ROOT_ONLY_PERMISSIONS]
        if blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Solo root puede asignar el/los permiso(s): {', '.join(blocked)}",
            )
    return permissions


def create_role(db: Session, data: RoleCreate, current_user: dict) -> Role:
    if role_repository.get_by_name(db, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un rol con el nombre '{data.name}'",
        )
    # Sin selección explícita, el rol arranca solo con los permisos públicos.
    if data.permission_ids is None:
        permissions = permission_repository.list_public(db)
    else:
        permissions = _resolve_permissions(db, data.permission_ids, current_user)
    return role_repository.create(db, data.name, data.description, permissions)


def update_role(db: Session, role_id: UUID, data: RoleUpdate, current_user: dict) -> Role:
    role = get_role(db, role_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != role.name:
        if role_repository.get_by_name(db, update_data["name"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un rol con el nombre '{update_data['name']}'",
            )

    permission_ids = update_data.pop("permission_ids", None)

    for field, value in update_data.items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)

    if permission_ids is not None:
        permissions = _resolve_permissions(db, permission_ids, current_user)
        role = role_repository.set_permissions(db, role, permissions)

    return role


def delete_role(db: Session, role_id: UUID) -> None:
    role = get_role(db, role_id)
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar un rol que tiene usuarios asignados",
        )
    role_repository.delete(db, role)
