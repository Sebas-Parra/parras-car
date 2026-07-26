from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.dto.permission import PermissionRead
from app.repositories import permission_repository

router = APIRouter(prefix="/permissions", tags=["permissions"])


# Admin / root only — catálogo de permisos disponibles para armar roles
@router.get("", response_model=list[PermissionRead])
def list_permissions(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    return permission_repository.list_all(db)
