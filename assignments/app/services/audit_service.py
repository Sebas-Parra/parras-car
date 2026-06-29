from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.assignment_audit import ActionType, AssignmentAudit
from app.repositories import audit_repository


class AuditService:
    """Provides read access to the audit trail.
    CREACION and ELIMINACION are recorded automatically by SQLAlchemy event listeners (db/listeners.py).
    MODIFICACION is recorded explicitly here because it represents a business-level transfer event
    that cannot be inferred from individual ORM operations.
    """

    def record_transfer(
        self,
        db: Session,
        from_user_id: UUID,
        to_user_id: UUID,
        vehicle_id: UUID,
    ) -> None:
        audit_repository.create_audit(
            db,
            to_user_id,
            vehicle_id,
            ActionType.MODIFICACION,
            previous_data={"user_id": str(from_user_id), "vehicle_id": str(vehicle_id), "active": True},
            new_data={"user_id": str(to_user_id), "vehicle_id": str(vehicle_id), "active": True},
        )

    def list_all(self, db: Session) -> list[AssignmentAudit]:
        return audit_repository.list_all(db)

    def list_by_assignment(self, db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
        return audit_repository.list_by_assignment(db, user_id, vehicle_id)
