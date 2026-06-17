from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.dto.auth import AccessTokenResponse, MeResponse, RefreshRequest, TokenResponse
from app.entities.user import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return auth_service.login(db, form_data.username, form_data.password)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_access_token(db, data.refresh_token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    person = current_user.person
    return MeResponse(
        id=person.id,
        cedula=person.cedula,
        first_name=person.first_name,
        middle_name=person.middle_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        address=person.address,
        nationality=person.nationality,
        active=person.active,
        username=current_user.username,
        roles=[role.name for role in current_user.roles],
    )
