from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_bearer_token, get_db, require_admin, require_self_or_admin
from app.dto.assignment import AssignmentCreate, AssignmentRead, AssignmentTransfer, FleetResponse
from app.dto.audit import AuditRead
from app.services.assignment_service import AssignmentService
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_service import AuditService

router = APIRouter(prefix="/assignments", tags=["assignments"])


def get_assignment_service() -> AssignmentService:
    return AssignmentService(validator=AssignmentValidator(), audit=AuditService())


# Admin / root only
@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.create(db, data, token)


# Admin / root only
@router.delete("/{user_id}/{vehicle_id}", response_model=AssignmentRead)
def delete_assignment(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_admin),
):
    return svc.delete(db, user_id, vehicle_id)


# Admin / root only
@router.patch("/{vehicle_id}/transfer", response_model=AssignmentRead)
def transfer_assignment(
    vehicle_id: UUID,
    data: AssignmentTransfer,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.transfer(db, vehicle_id, data, token)


# No auth — internal call from vehicles service (server-to-server, no user token)
@router.get("/by-vehicle/{vehicle_id}", response_model=AssignmentRead)
def get_active_by_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    """Returns the active assignment for a vehicle.
    404 means the vehicle has no active owner and is safe to delete.
    """
    return svc.get_active_by_vehicle(db, vehicle_id)


# Admin / root only
@router.get("/audit", response_model=list[AuditRead])
def list_audit(
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_admin),
):
    return svc.list_audit(db)


# Own data or admin/root — cliente solo ve su propia flota
@router.get("/{user_id}/fleet", response_model=FleetResponse)
def get_fleet(
    user_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_self_or_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.get_fleet(db, user_id, token)


# Own data or admin/root
@router.get("/{user_id}/{vehicle_id}/audit", response_model=list[AuditRead])
def get_assignment_audit(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_self_or_admin),
):
    return svc.get_assignment_audit(db, user_id, vehicle_id)
