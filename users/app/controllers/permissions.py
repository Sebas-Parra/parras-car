from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.dto.permission import PermissionRead
from app.repositories import permission_repository

router = APIRouter(prefix="/permissions", tags=["permissions"])


# Admin / root, o quien tenga el permiso "gestionar_roles" — catálogo de
# permisos disponibles para armar roles
@router.get("", response_model=list[PermissionRead])
def list_permissions(db: Session = Depends(get_db), _: dict = Depends(require_permission("gestionar_roles"))):
    return permission_repository.list_all(db)
