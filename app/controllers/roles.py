from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.dto.role import RoleRead
from app.entities.user import User
from app.services import role_service

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return role_service.list_roles(db)
