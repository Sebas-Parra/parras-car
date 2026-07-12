from unittest.mock import patch

from app.dto.user import UserUpdate
from app.entities.role import Role
from app.services import user_service


CURRENT_USER = {"username": "admin", "roles": ["administrador"]}


def _get_admin_user(db_session):
    from app.entities.user import User

    return db_session.query(User).filter(User.username == "admin").one()


@patch("app.services.user_service.publish_audit_event")
def test_update_user_publishes_update_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)

    user_service.update_user(db_session, admin_user.id_person, UserUpdate(username="admin2"), CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.user_service.publish_audit_event")
def test_deactivate_user_publishes_delete_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)

    user_service.deactivate_user(db_session, admin_user.id_person, CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "DELETE"


@patch("app.services.user_service.publish_audit_event")
def test_assign_role_publishes_update_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)
    visitante_role = db_session.query(Role).filter(Role.name == "visitante").one()

    user_service.assign_role(db_session, admin_user.id_person, visitante_role.id, CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "UPDATE"
