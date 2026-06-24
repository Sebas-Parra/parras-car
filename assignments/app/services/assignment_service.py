from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.assignment import AssignmentCreate, AssignmentRead, FleetResponse, VehicleDetail
from app.entities.assignment_audit import AssignmentAudit
from app.repositories import assignment_repository
from app.services import vehicles_client
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_service import AuditService


class AssignmentService:
    """Orchestrates the assignment lifecycle.
    Audit recording is decoupled — handled transparently by ORM event listeners.
    """

    def __init__(self, validator: AssignmentValidator, audit: AuditService) -> None:
        self._validator = validator
        self._audit = audit

    def create(self, db: Session, data: AssignmentCreate) -> AssignmentRead:
        self._validator.require_user_exists(data.user_id)
        self._validator.require_vehicle_exists(data.vehicle_id)
        self._validator.require_vehicle_available(db, data.vehicle_id, data.user_id)

        existing = assignment_repository.get_by_ids(db, data.user_id, data.vehicle_id)
        self._validator.require_not_already_active(existing)

        if existing:
            existing.active = True  # triggers after_update listener → MODIFICACION audit
            db.commit()
            db.refresh(existing)
            return existing

        assignment = assignment_repository.create(db, data.user_id, data.vehicle_id)  # triggers after_insert → CREACION audit
        db.commit()
        db.refresh(assignment)
        return assignment

    def delete(self, db: Session, user_id: UUID, vehicle_id: UUID) -> AssignmentRead:
        assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
        if not assignment or not assignment.active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active assignment not found")

        assignment_repository.soft_delete(db, assignment)  # triggers after_update listener → ELIMINACION audit
        db.commit()
        db.refresh(assignment)
        return assignment

    def get_fleet(self, db: Session, user_id: UUID) -> FleetResponse:
        assignments = assignment_repository.list_active_by_user(db, user_id)
        vehicles: list[VehicleDetail] = []
        for assignment in assignments:
            vehicle_data = vehicles_client.get_vehicle(assignment.vehicle_id)
            if vehicle_data:
                vehicles.append(
                    VehicleDetail(
                        id=vehicle_data["id"],
                        plate=vehicle_data.get("plate", ""),
                        brand=vehicle_data.get("brand", ""),
                        model=vehicle_data.get("model", ""),
                        color=vehicle_data.get("color", ""),
                        year=vehicle_data.get("year", 0),
                        clasification=vehicle_data.get("clasification", ""),
                        tipo=vehicle_data.get("tipo") or vehicle_data.get("type"),
                    )
                )
        return FleetResponse(user_id=user_id, total=len(vehicles), vehicles=vehicles)

    def list_audit(self, db: Session) -> list[AssignmentAudit]:
        return self._audit.list_all(db)

    def get_assignment_audit(self, db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
        return self._audit.list_by_assignment(db, user_id, vehicle_id)
