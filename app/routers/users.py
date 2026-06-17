from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role, require_self_or_admin_user
from app.schemas.role import RoleAssign
from app.schemas.user import UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead], dependencies=[Depends(require_role("administrador"))])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return user_service.list_users(db, skip, limit)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_self_or_admin_user)):
    return user_service.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _=Depends(require_self_or_admin_user)):
    return user_service.update_user(db, user_id, data)


@router.patch("/{user_id}/deactivate", response_model=UserRead, dependencies=[Depends(require_role("administrador"))])
def deactivate_user(user_id: int, db: Session = Depends(get_db)):
    return user_service.deactivate_user(db, user_id)


@router.patch("/{user_id}/activate", response_model=UserRead, dependencies=[Depends(require_role("administrador"))])
def activate_user(user_id: int, db: Session = Depends(get_db)):
    return user_service.activate_user(db, user_id)


@router.post("/{user_id}/roles", response_model=UserRead, dependencies=[Depends(require_role("administrador"))])
def assign_role(user_id: int, data: RoleAssign, db: Session = Depends(get_db)):
    return user_service.assign_role(db, user_id, data.role_id)


@router.delete("/{user_id}/roles/{role_id}", response_model=UserRead, dependencies=[Depends(require_role("administrador"))])
def remove_role(user_id: int, role_id: int, db: Session = Depends(get_db)):
    return user_service.remove_role(db, user_id, role_id)
