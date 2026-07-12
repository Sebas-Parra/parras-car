from unittest.mock import patch

from app.dto.person import PersonUpdate
from app.dto.user import UserCreate
from app.entities.role import Role
from app.services import person_service


def _ensure_cliente_role(db_session):
    role = db_session.query(Role).filter(Role.name == "cliente").first()
    if role is None:
        role = Role(name="cliente", description="Cliente")
        db_session.add(role)
        db_session.flush()
    return role


@patch("app.services.person_service.publish_audit_event")
def test_create_person_with_user_publishes_create_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)

    data = UserCreate(
        cedula="1710000017",
        first_name="Pepe",
        middle_name="Mario",
        last_name="Diaz",
        email="pepe@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )

    person = person_service.create_person_with_user(db_session, data)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "CREATE"
    assert kwargs["entidad_id"] == str(person.id)
    assert kwargs["usuario"] == person.user.username
    assert kwargs["rol"] == "cliente"


@patch("app.services.person_service.publish_audit_event")
def test_update_person_publishes_update_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000025",
        first_name="Update",
        middle_name="Me",
        last_name="Me",
        email="updateme@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )
    person = person_service.create_person_with_user(db_session, data)
    mock_publish.reset_mock()
    current_user = {"username": "admin", "roles": ["administrador"]}

    person_service.update_person(db_session, person.id, PersonUpdate(phone="0987654321"), current_user)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.person_service.publish_audit_event")
def test_deactivate_person_publishes_delete_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000033",
        first_name="Deact",
        middle_name="Me",
        last_name="Me",
        email="deactme@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )
    person = person_service.create_person_with_user(db_session, data)
    mock_publish.reset_mock()
    current_user = {"username": "admin", "roles": ["administrador"]}

    person_service.deactivate_person(db_session, person.id, current_user)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "DELETE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"
