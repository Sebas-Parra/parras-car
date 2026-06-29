from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.role import RoleAssign
from app.dto.user import UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


# Admin / root only
@router.get("", response_model=list[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.list_users(db, skip, limit)


# Own data or admin/root
@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_self_or_admin),
):
    return user_service.get_user(db, user_id)


# Own data or admin/root
@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_self_or_admin),
):
    return user_service.update_user(db, user_id, data)


# Admin / root only
@router.patch("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.deactivate_user(db, user_id)


# Admin / root only
@router.patch("/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.activate_user(db, user_id)


# Admin / root only
@router.post("/{user_id}/roles", response_model=UserRead)
def assign_role(
    user_id: UUID,
    data: RoleAssign,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.assign_role(db, user_id, data.role_id)


# Admin / root only
@router.delete("/{user_id}/roles/{role_id}", response_model=UserRead)
def remove_role(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.remove_role(db, user_id, role_id)
