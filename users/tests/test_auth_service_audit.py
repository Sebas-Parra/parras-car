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
    assert kwargs["rol"] == "admin"


@patch("app.services.auth_service.publish_audit_event")
def test_login_publishes_the_client_ip_when_provided(mock_publish, db_session):
    auth_service.login(
        db_session, LoginRequest(username="admin", password="Admin123!"), ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


@patch("app.services.auth_service.publish_audit_event")
def test_logout_publishes_logout_event(mock_publish, db_session):
    response = auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))
    mock_publish.reset_mock()

    auth_service.logout(db_session, LogoutRequest(refresh_token=response.refresh_token))

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "LOGOUT"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "admin"


@patch("app.services.auth_service.publish_audit_event")
def test_logout_publishes_the_client_ip_when_provided(mock_publish, db_session):
    response = auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))
    mock_publish.reset_mock()

    auth_service.logout(
        db_session, LogoutRequest(refresh_token=response.refresh_token), ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"
