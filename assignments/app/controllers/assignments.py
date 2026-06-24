from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.dto.assignment import AssignmentCreate, AssignmentRead, FleetResponse
from app.dto.audit import AuditRead
from app.services import assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(data: AssignmentCreate, db: Session = Depends(get_db)):
    return assignment_service.create_assignment(db, data)


@router.delete("/{user_id}/{vehicle_id}", response_model=AssignmentRead)
def delete_assignment(user_id: UUID, vehicle_id: UUID, db: Session = Depends(get_db)):
    return assignment_service.delete_assignment(db, user_id, vehicle_id)


@router.get("/audit", response_model=list[AuditRead])
def list_audit(db: Session = Depends(get_db)):
    return assignment_service.list_audit(db)


@router.get("/{user_id}/fleet", response_model=FleetResponse)
def get_fleet(user_id: UUID, db: Session = Depends(get_db)):
    return assignment_service.get_fleet(db, user_id)


@router.get("/{user_id}/{vehicle_id}/audit", response_model=list[AuditRead])
def get_assignment_audit(user_id: UUID, vehicle_id: UUID, db: Session = Depends(get_db)):
    return assignment_service.get_assignment_audit(db, user_id, vehicle_id)
