from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.assignment import (
    AssignmentCreate,
    AssignmentRead,
    AssignmentTransfer,
    FleetResponse,
    FleetVehicleIdsResponse,
    VehicleDetail,
)
from app.entities.assignment_audit import AssignmentAudit
from app.repositories import assignment_repository
from app.services import vehicles_client
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_publisher import publish_audit_event
from app.services.audit_service import AuditService


class AssignmentService:
    """Orchestrates the assignment lifecycle.
    Local audit recording is decoupled — handled transparently by ORM event listeners.
    Centralized ms-audit publishing happens explicitly here, alongside it.
    """

    def __init__(self, validator: AssignmentValidator, audit: AuditService) -> None:
        self._validator = validator
        self._audit = audit

    def create(
        self,
        db: Session,
        data: AssignmentCreate,
        token: str,
        current_user: dict,
        ip: str | None = None,
    ) -> AssignmentRead:
        self._validator.require_user_active(data.user_id, token)
        self._validator.require_vehicle_active(data.vehicle_id, token)
        self._validator.require_vehicle_available(db, data.vehicle_id, data.user_id)

        existing = assignment_repository.get_by_ids(db, data.user_id, data.vehicle_id)
        self._validator.require_not_already_active(existing)

        if existing:
            existing.active = True  # triggers after_update listener → MODIFICACION audit
            db.commit()
            db.refresh(existing)
            self._emit_audit_event("UPDATE", data.user_id, data.vehicle_id, current_user, ip)
            return existing

        assignment = assignment_repository.create(db, data.user_id, data.vehicle_id)  # triggers after_insert → CREACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("CREATE", data.user_id, data.vehicle_id, current_user, ip)
        return assignment

    def delete(
        self, db: Session, user_id: UUID, vehicle_id: UUID, current_user: dict, ip: str | None = None
    ) -> AssignmentRead:
        assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
        if not assignment or not assignment.active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación activa no encontrada")

        assignment_repository.soft_delete(db, assignment)  # triggers after_update listener → ELIMINACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("DELETE", user_id, vehicle_id, current_user, ip)
        return assignment

    def transfer(
        self,
        db: Session,
        vehicle_id: UUID,
        data: AssignmentTransfer,
        token: str,
        current_user: dict,
        ip: str | None = None,
    ) -> AssignmentRead:
        self._validator.require_different_users(data.from_user_id, data.to_user_id)
        self._validator.require_user_active(data.from_user_id, token)
        self._validator.require_user_active(data.to_user_id, token)
        self._validator.require_vehicle_active(vehicle_id, token)
        self._validator.require_active_assignment(db, data.from_user_id, vehicle_id)

        old_assignment = assignment_repository.get_by_ids(db, data.from_user_id, vehicle_id)
        assignment_repository.soft_delete(db, old_assignment)  # listener → ELIMINACION

        # to_user may have had this vehicle before (inactive row) — reactivate instead of insert
        existing_for_new_user = assignment_repository.get_by_ids(db, data.to_user_id, vehicle_id)
        if existing_for_new_user:
            existing_for_new_user.active = True  # listener → CREACION (after_update treated as MODIFICACION)
            new_assignment = existing_for_new_user
        else:
            new_assignment = assignment_repository.create(db, data.to_user_id, vehicle_id)  # listener → CREACION

        self._audit.record_transfer(db, data.from_user_id, data.to_user_id, vehicle_id)  # explicit → MODIFICACION

        db.commit()
        db.refresh(new_assignment)

        publish_audit_event(
            accion="UPDATE",
            entidad_id=str(vehicle_id),
            usuario=current_user.get("username", ""),
            rol=(current_user.get("roles") or [""])[0],
            datos={"from_user_id": str(data.from_user_id), "to_user_id": str(data.to_user_id)},
            ip=ip,
        )
        return new_assignment

    def get_fleet_vehicle_ids(self, db: Session, user_id: UUID) -> FleetVehicleIdsResponse:
        """Solo IDs, sin consultar el servicio de vehículos — evita el ciclo
        vehicles -> assignments -> vehicles que se dispara al validar
        propiedad de un vehículo desde vehicles.findOne/findAll.
        """
        assignments = assignment_repository.list_active_by_user(db, user_id)
        return FleetVehicleIdsResponse(
            user_id=user_id,
            vehicle_ids=[a.vehicle_id for a in assignments],
        )

    def get_fleet(self, db: Session, user_id: UUID, token: str) -> FleetResponse:
        assignments = assignment_repository.list_active_by_user(db, user_id)
        vehicles: list[VehicleDetail] = []
        for assignment in assignments:
            vehicle_data = vehicles_client.get_vehicle(assignment.vehicle_id, token)
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

    def get_active_by_vehicle(self, db: Session, vehicle_id: UUID) -> AssignmentRead:
        assignment = assignment_repository.get_active_by_vehicle(db, vehicle_id)
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle has no active assignment — safe to delete",
            )
        return assignment

    def list_audit(self, db: Session, skip: int = 0, limit: int = 100) -> tuple[list[AssignmentAudit], int]:
        return self._audit.list_all(db, skip, limit)

    def get_assignment_audit(self, db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
        return self._audit.list_by_assignment(db, user_id, vehicle_id)

    def _emit_audit_event(
        self, accion: str, user_id: UUID, vehicle_id: UUID, current_user: dict, ip: str | None = None
    ) -> None:
        roles = current_user.get("roles") or []
        publish_audit_event(
            accion=accion,
            entidad_id=f"{user_id}:{vehicle_id}",
            usuario=current_user.get("username", ""),
            rol=roles[0] if roles else "",
            datos={"user_id": str(user_id), "vehicle_id": str(vehicle_id)},
            ip=ip,
        )
