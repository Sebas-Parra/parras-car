from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.entities.vehicle_assignment import VehicleAssignment
from app.repositories import assignment_repository
from app.services import vehicles_client


class AssignmentValidator:
    """Validates preconditions before any assignment operation."""

    def require_user_exists(self, user_id: UUID, token: str) -> dict:
        user = vehicles_client.get_user(user_id, token)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        return user

    def require_user_active(self, user_id: UUID, token: str) -> None:
        user = self.require_user_exists(user_id, token)
        if not user.get("active", True):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El usuario {user_id} no está activo",
            )

    def require_vehicle_exists(self, vehicle_id: UUID, token: str) -> dict:
        vehicle = vehicles_client.get_vehicle_for_assignment_validation(vehicle_id, token)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado")
        return vehicle

    def require_vehicle_active(self, vehicle_id: UUID, token: str) -> None:
        vehicle = self.require_vehicle_exists(vehicle_id, token)
        if not vehicle.get("active", True):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El vehículo no está activo y no puede ser asignado",
            )

    def require_different_users(self, from_user_id: UUID, to_user_id: UUID) -> None:
        if str(from_user_id) == str(to_user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El origen y destino de la transferencia deben ser usuarios diferentes",
            )

    def require_vehicle_available(self, db: Session, vehicle_id: UUID, requesting_user_id: UUID) -> None:
        active_owner = assignment_repository.get_active_by_vehicle(db, vehicle_id)
        if active_owner and str(active_owner.user_id) != str(requesting_user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El vehículo ya está asignado a otro propietario activo",
            )

    def require_not_already_active(self, existing: VehicleAssignment | None) -> None:
        if existing and existing.active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La asignación ya existe y está activa",
            )

    def require_active_assignment(self, db: Session, user_id: UUID, vehicle_id: UUID) -> VehicleAssignment:
        assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
        if not assignment or not assignment.active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró una asignación activa para este usuario y vehículo",
            )
        return assignment
