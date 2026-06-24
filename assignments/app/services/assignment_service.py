from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.assignment import AssignmentCreate, AssignmentRead, FleetResponse, VehicleDetail
from app.dto.audit import AuditRead
from app.entities.assignment_audit import ActionType
from app.repositories import assignment_repository, audit_repository
from app.services import vehicles_client


def create_assignment(db: Session, data: AssignmentCreate) -> AssignmentRead:
    user = vehicles_client.get_user(data.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    vehicle = vehicles_client.get_vehicle(data.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    active_owner = assignment_repository.get_active_by_vehicle(db, data.vehicle_id)
    if active_owner and str(active_owner.user_id) != str(data.user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle is already assigned to another active owner",
        )

    existing = assignment_repository.get_by_ids(db, data.user_id, data.vehicle_id)
    if existing:
        if existing.active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assignment already exists and is active",
            )
        existing.active = True
        audit_repository.create_audit(
            db,
            data.user_id,
            data.vehicle_id,
            ActionType.MODIFICACION,
            previous_data={"active": False},
            new_data={"active": True},
        )
        db.commit()
        db.refresh(existing)
        return existing

    assignment = assignment_repository.create(db, data.user_id, data.vehicle_id)
    audit_repository.create_audit(
        db,
        data.user_id,
        data.vehicle_id,
        ActionType.CREACION,
        new_data={"user_id": str(data.user_id), "vehicle_id": str(data.vehicle_id)},
    )
    db.commit()
    db.refresh(assignment)
    return assignment


def delete_assignment(db: Session, user_id: UUID, vehicle_id: UUID) -> AssignmentRead:
    assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
    if not assignment or not assignment.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active assignment not found")

    previous = {"user_id": str(user_id), "vehicle_id": str(vehicle_id), "active": True}
    assignment_repository.soft_delete(db, assignment)
    audit_repository.create_audit(
        db,
        user_id,
        vehicle_id,
        ActionType.ELIMINACION,
        previous_data=previous,
        new_data={"active": False},
    )
    db.commit()
    db.refresh(assignment)
    return assignment


def get_fleet(db: Session, user_id: UUID) -> FleetResponse:
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


def list_audit(db: Session) -> list[AuditRead]:
    return audit_repository.list_all(db)


def get_assignment_audit(db: Session, user_id: UUID, vehicle_id: UUID) -> list[AuditRead]:
    return audit_repository.list_by_assignment(db, user_id, vehicle_id)
