from uuid import UUID

from sqlalchemy.orm import Session

from app.entities.assignment_audit import ActionType, AssignmentAudit


def create_audit(
    db: Session,
    user_id: UUID,
    vehicle_id: UUID,
    action: ActionType,
    previous_data: dict | None = None,
    new_data: dict | None = None,
) -> AssignmentAudit:
    audit = AssignmentAudit(
        user_id=user_id,
        vehicle_id=vehicle_id,
        action=action,
        previous_data=previous_data,
        new_data=new_data,
    )
    db.add(audit)
    db.flush()
    return audit


def list_all(db: Session) -> list[AssignmentAudit]:
    return db.query(AssignmentAudit).order_by(AssignmentAudit.timestamp.desc()).all()


def list_by_assignment(db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
    return (
        db.query(AssignmentAudit)
        .filter(AssignmentAudit.user_id == user_id, AssignmentAudit.vehicle_id == vehicle_id)
        .order_by(AssignmentAudit.timestamp.desc())
        .all()
    )
