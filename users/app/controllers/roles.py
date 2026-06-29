from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_root
from app.dto.role import RoleCreate, RoleRead, RoleUpdate
from app.services import role_service

router = APIRouter(prefix="/roles", tags=["roles"])


# Admin / root only
@router.get("", response_model=list[RoleRead])
def list_roles(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    return role_service.list_roles(db)


# Admin / root only
@router.get("/{role_id}", response_model=RoleRead)
def get_role(role_id: UUID, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    return role_service.get_role(db, role_id)


# Admin / root only
@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(data: RoleCreate, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    return role_service.create_role(db, data)


# Admin / root only
@router.put("/{role_id}", response_model=RoleRead)
def update_role(role_id: UUID, data: RoleUpdate, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    return role_service.update_role(db, role_id, data)


# Root only — eliminación física de roles
@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: UUID, db: Session = Depends(get_db), _: dict = Depends(require_root)):
    role_service.delete_role(db, role_id)
