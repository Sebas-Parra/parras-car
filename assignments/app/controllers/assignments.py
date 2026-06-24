from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.dto.assignment import AssignmentCreate, AssignmentRead, FleetResponse
from app.dto.audit import AuditRead
from app.services.assignment_service import AssignmentService
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_service import AuditService

router = APIRouter(prefix="/assignments", tags=["assignments"])


def get_assignment_service() -> AssignmentService:
    return AssignmentService(validator=AssignmentValidator(), audit=AuditService())


@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    return svc.create(db, data)


@router.delete("/{user_id}/{vehicle_id}", response_model=AssignmentRead)
def delete_assignment(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    return svc.delete(db, user_id, vehicle_id)


@router.get("/audit", response_model=list[AuditRead])
def list_audit(
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    return svc.list_audit(db)


@router.get("/{user_id}/fleet", response_model=FleetResponse)
def get_fleet(
    user_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    return svc.get_fleet(db, user_id)


@router.get("/{user_id}/{vehicle_id}/audit", response_model=list[AuditRead])
def get_assignment_audit(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    return svc.get_assignment_audit(db, user_id, vehicle_id)
