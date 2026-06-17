from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role, require_self_or_admin_person
from app.dto.person import PersonRead, PersonUpdate
from app.dto.user import PersonWithUserRead, UserCreate
from app.services import person_service

router = APIRouter(prefix="/persons", tags=["persons"])


@router.post("", response_model=PersonWithUserRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("administrador"))])
def create_person(data: UserCreate, db: Session = Depends(get_db)):
    return person_service.create_person_with_user(db, data)


@router.get("", response_model=list[PersonRead], dependencies=[Depends(require_role("administrador"))])
def list_persons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return person_service.list_persons(db, skip, limit)


@router.get("/{person_id}", response_model=PersonRead)
def get_person(person_id: int, db: Session = Depends(get_db), _=Depends(require_self_or_admin_person)):
    return person_service.get_person(db, person_id)


@router.put("/{person_id}", response_model=PersonRead)
def update_person(person_id: int, data: PersonUpdate, db: Session = Depends(get_db), _=Depends(require_self_or_admin_person)):
    return person_service.update_person(db, person_id, data)


@router.patch("/{person_id}/deactivate", response_model=PersonRead, dependencies=[Depends(require_role("administrador"))])
def deactivate_person(person_id: int, db: Session = Depends(get_db)):
    return person_service.deactivate_person(db, person_id)


@router.patch("/{person_id}/activate", response_model=PersonRead, dependencies=[Depends(require_role("administrador"))])
def activate_person(person_id: int, db: Session = Depends(get_db)):
    return person_service.activate_person(db, person_id)
