from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.entities.vehicle_assignment import VehicleAssignment
from app.repositories import assignment_repository
from app.services import vehicles_client


class AssignmentValidator:
    """Validates preconditions before any assignment operation."""

    def require_user_exists(self, user_id: UUID) -> None:
        if not vehicles_client.get_user(user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    def require_vehicle_exists(self, vehicle_id: UUID) -> None:
        if not vehicles_client.get_vehicle(vehicle_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    def require_vehicle_available(self, db: Session, vehicle_id: UUID, requesting_user_id: UUID) -> None:
        active_owner = assignment_repository.get_active_by_vehicle(db, vehicle_id)
        if active_owner and str(active_owner.user_id) != str(requesting_user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle is already assigned to another active owner",
            )

    def require_not_already_active(self, existing: VehicleAssignment | None) -> None:
        if existing and existing.active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assignment already exists and is active",
            )
