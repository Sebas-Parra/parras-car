import uuid as uuid_module

from sqlalchemy import event
from sqlalchemy.orm import attributes

from app.entities.assignment_audit import ActionType, AssignmentAudit
from app.entities.vehicle_assignment import VehicleAssignment


@event.listens_for(VehicleAssignment, "after_insert")
def _on_assignment_created(mapper, connection, target: VehicleAssignment) -> None:
    connection.execute(
        AssignmentAudit.__table__.insert().values(
            id=uuid_module.uuid4(),
            user_id=target.user_id,
            vehicle_id=target.vehicle_id,
            action=ActionType.CREACION,
            previous_data=None,
            new_data={"user_id": str(target.user_id), "vehicle_id": str(target.vehicle_id)},
        )
    )


@event.listens_for(VehicleAssignment, "after_update")
def _on_assignment_updated(mapper, connection, target: VehicleAssignment) -> None:
    history = attributes.get_history(target, "active")
    if not history.has_changes():
        return

    old_val = history.deleted[0] if history.deleted else None
    new_val = history.added[0] if history.added else target.active
    action = ActionType.ELIMINACION if new_val is False else ActionType.MODIFICACION

    connection.execute(
        AssignmentAudit.__table__.insert().values(
            id=uuid_module.uuid4(),
            user_id=target.user_id,
            vehicle_id=target.vehicle_id,
            action=action,
            previous_data={"active": old_val},
            new_data={"active": new_val},
        )
    )
