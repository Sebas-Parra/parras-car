from unittest.mock import patch

from app.dto.auth import LoginRequest, LogoutRequest
from app.services import auth_service


@patch("app.services.auth_service.publish_audit_event")
def test_login_publishes_login_event(mock_publish, db_session):
    auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "LOGIN"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.auth_service.publish_audit_event")
def test_logout_publishes_logout_event(mock_publish, db_session):
    response = auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))
    mock_publish.reset_mock()

    auth_service.logout(db_session, LogoutRequest(refresh_token=response.refresh_token))

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "LOGOUT"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"
