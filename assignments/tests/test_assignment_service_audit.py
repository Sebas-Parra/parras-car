from unittest.mock import MagicMock, patch
from uuid import UUID

from app.dto.assignment import AssignmentCreate, AssignmentTransfer
from app.services.assignment_service import AssignmentService

USER_ID = UUID("11111111-1111-1111-1111-111111111111")
USER_ID_2 = UUID("44444444-4444-4444-4444-444444444444")
VEHICLE_ID = UUID("22222222-2222-2222-2222-222222222222")

CURRENT_USER = {"username": "jdoe", "roles": ["admin"], "sub": str(USER_ID)}


def _service(validator=None, audit=None) -> AssignmentService:
    return AssignmentService(
        validator=validator or MagicMock(),
        audit=audit or MagicMock(),
    )


@patch("app.services.assignment_service.publish_audit_event")
def test_create_publishes_a_create_event_for_a_brand_new_assignment(mock_publish, db_session):
    svc = _service()

    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "CREATE"
    assert kwargs["entidad_id"] == f"{USER_ID}:{VEHICLE_ID}"
    assert kwargs["usuario"] == "jdoe"
    assert kwargs["rol"] == "admin"


@patch("app.services.assignment_service.publish_audit_event")
def test_create_publishes_an_update_event_when_reactivating_an_existing_row(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    svc.delete(db_session, USER_ID, VEHICLE_ID, CURRENT_USER)
    mock_publish.reset_mock()

    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "UPDATE"


@patch("app.services.assignment_service.publish_audit_event")
def test_delete_publishes_a_delete_event(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.delete(db_session, USER_ID, VEHICLE_ID, CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "DELETE"
    assert kwargs["entidad_id"] == f"{USER_ID}:{VEHICLE_ID}"


@patch("app.services.assignment_service.publish_audit_event")
def test_transfer_publishes_a_single_update_event(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.transfer(
        db_session,
        VEHICLE_ID,
        AssignmentTransfer(from_user_id=USER_ID, to_user_id=USER_ID_2),
        "token",
        CURRENT_USER,
    )

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["entidad_id"] == str(VEHICLE_ID)
    assert kwargs["datos"] == {"from_user_id": str(USER_ID), "to_user_id": str(USER_ID_2)}
