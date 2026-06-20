from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.dto.role import RoleCreate, RoleRead, RoleUpdate
from app.services import role_service

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(db: Session = Depends(get_db)):
    return role_service.list_roles(db)


@router.get("/{role_id}", response_model=RoleRead)
def get_role(role_id: UUID, db: Session = Depends(get_db)):
    return role_service.get_role(db, role_id)


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(data: RoleCreate, db: Session = Depends(get_db)):
    return role_service.create_role(db, data)


@router.put("/{role_id}", response_model=RoleRead)
def update_role(role_id: UUID, data: RoleUpdate, db: Session = Depends(get_db)):
    return role_service.update_role(db, role_id, data)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: UUID, db: Session = Depends(get_db)):
    role_service.delete_role(db, role_id)
