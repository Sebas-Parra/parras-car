from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.vehicle_assignment import VehicleAssignment


def get_by_ids(db: Session, user_id: UUID, vehicle_id: UUID) -> VehicleAssignment | None:
    return (
        db.query(VehicleAssignment)
        .filter(VehicleAssignment.user_id == user_id, VehicleAssignment.vehicle_id == vehicle_id)
        .first()
    )


def get_active_by_vehicle(db: Session, vehicle_id: UUID) -> VehicleAssignment | None:
    return (
        db.query(VehicleAssignment)
        .filter(VehicleAssignment.vehicle_id == vehicle_id, VehicleAssignment.active.is_(True))
        .first()
    )


def list_active_by_user(db: Session, user_id: UUID) -> list[VehicleAssignment]:
    return (
        db.query(VehicleAssignment)
        .filter(VehicleAssignment.user_id == user_id, VehicleAssignment.active.is_(True))
        .all()
    )


def create(db: Session, user_id: UUID, vehicle_id: UUID) -> VehicleAssignment:
    assignment = VehicleAssignment(user_id=user_id, vehicle_id=vehicle_id)
    db.add(assignment)
    db.flush()
    return assignment


def soft_delete(db: Session, assignment: VehicleAssignment) -> VehicleAssignment:
    assignment.active = False
    db.flush()
    return assignment
