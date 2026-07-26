from unittest.mock import MagicMock, patch
from uuid import UUID

import httpx

from app.services import vehicles_client

VEHICLE_ID = UUID("22222222-2222-2222-2222-222222222222")
USER_ID = UUID("11111111-1111-1111-1111-111111111111")


class TestGetVehicle:
    def test_returns_json_on_200(self):
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"id": str(VEHICLE_ID), "plate": "ABC123"}
        with patch("httpx.get", return_value=mock_response) as mock_get:
            result = vehicles_client.get_vehicle(VEHICLE_ID, "token123")
        assert result == {"id": str(VEHICLE_ID), "plate": "ABC123"}
        mock_get.assert_called_once()
        assert mock_get.call_args.kwargs["headers"] == {"Authorization": "Bearer token123"}

    def test_returns_none_on_non_200(self):
        mock_response = MagicMock(status_code=404)
        with patch("httpx.get", return_value=mock_response):
            result = vehicles_client.get_vehicle(VEHICLE_ID, "token123")
        assert result is None

    def test_returns_none_on_request_error(self):
        with patch("httpx.get", side_effect=httpx.RequestError("boom")):
            result = vehicles_client.get_vehicle(VEHICLE_ID, "token123")
        assert result is None


class TestGetUser:
    def test_returns_json_on_200(self):
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"id_person": str(USER_ID), "username": "testuser"}
        with patch("httpx.get", return_value=mock_response) as mock_get:
            result = vehicles_client.get_user(USER_ID, "token123")
        assert result == {"id_person": str(USER_ID), "username": "testuser"}
        mock_get.assert_called_once()
        assert mock_get.call_args.kwargs["headers"] == {"Authorization": "Bearer token123"}

    def test_returns_none_on_non_200(self):
        mock_response = MagicMock(status_code=500)
        with patch("httpx.get", return_value=mock_response):
            result = vehicles_client.get_user(USER_ID, "token123")
        assert result is None

    def test_returns_none_on_request_error(self):
        with patch("httpx.get", side_effect=httpx.RequestError("boom")):
            result = vehicles_client.get_user(USER_ID, "token123")
        assert result is None
