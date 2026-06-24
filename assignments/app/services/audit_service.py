from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.assignment_audit import AssignmentAudit
from app.repositories import audit_repository


class AuditService:
    """Provides read access to the audit trail.
    Write operations are handled automatically by SQLAlchemy event listeners (db/listeners.py).
    """

    def list_all(self, db: Session) -> list[AssignmentAudit]:
        return audit_repository.list_all(db)

    def list_by_assignment(self, db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
        return audit_repository.list_by_assignment(db, user_id, vehicle_id)
