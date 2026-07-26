from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.role import RoleAssign
from app.dto.user import UserDetailRead, UserListResponse, UserRead, UserUpdate
from app.services import user_service
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/users", tags=["users"])

# Catálogo acotado por la cantidad real de usuarios registrados (no crece sin
# límite como tickets/auditoría), así que el tope es más alto para no romper
# los buscadores tipo-combobox de otras páginas que necesitan ver todo.
MAX_PAGE_SIZE = 500


class UserRolesRead(BaseModel):
    roles: list[str]


# Public endpoint for inter-service communication (no auth required)
@router.get("/{user_id}/roles", response_model=UserRolesRead)
def get_user_roles(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    user = user_service.get_user(db, user_id)
    roles = [r.name for r in user.roles]
    return UserRolesRead(roles=roles)


# Admin / root only
@router.get("", response_model=UserListResponse)
def list_users(
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    page = max(1, page)
    page_size = min(max(1, page_size), MAX_PAGE_SIZE)
    data, total = user_service.list_users(db, (page - 1) * page_size, page_size)
    return UserListResponse(data=data, total=total, page=page, page_size=page_size)


# Own data or admin/root
@router.get("/{user_id}", response_model=UserDetailRead)
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_self_or_admin),
):
    return user_service.update_user(db, user_id, data, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.deactivate_user(db, user_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.activate_user(db, user_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.post("/{user_id}/roles", response_model=UserRead)
def assign_role(
    user_id: UUID,
    data: RoleAssign,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.assign_role(db, user_id, data.role_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.delete("/{user_id}/roles/{role_id}", response_model=UserRead)
def remove_role(
    user_id: UUID,
    role_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.remove_role(db, user_id, role_id, current_user, ip=get_client_ip(request))
