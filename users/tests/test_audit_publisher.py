import json
from unittest.mock import MagicMock, patch

from app.services.audit_publisher import publish_audit_event


@patch("app.services.audit_publisher.pika.BlockingConnection")
def test_publishes_event_with_expected_payload(mock_blocking_connection):
    mock_channel = MagicMock()
    mock_connection = MagicMock()
    mock_connection.channel.return_value = mock_channel
    mock_blocking_connection.return_value = mock_connection

    publish_audit_event(
        accion="CREATE",
        entidad_id="user-1",
        usuario="jdoe",
        rol="cliente",
        datos={"username": "jdoe"},
    )

    mock_channel.exchange_declare.assert_called_once()
    mock_channel.basic_publish.assert_called_once()
    _, kwargs = mock_channel.basic_publish.call_args
    payload = json.loads(kwargs["body"])
    assert payload == {
        "servicio": "ms-users",
        "accion": "CREATE",
        "entidad": "USUARIO",
        "entidadId": "user-1",
        "datos": {"username": "jdoe"},
        "usuario": "jdoe",
        "rol": "cliente",
    }
    mock_connection.close.assert_called_once()


@patch(
    "app.services.audit_publisher.pika.BlockingConnection",
    side_effect=Exception("boom"),
)
def test_does_not_raise_when_rabbitmq_is_unreachable(mock_blocking_connection):
    # Must not raise — a broker outage cannot break the caller's request.
    publish_audit_event(
        accion="CREATE",
        entidad_id="user-1",
        usuario="jdoe",
        rol="cliente",
    )
