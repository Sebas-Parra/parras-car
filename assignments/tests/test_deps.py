from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.core.config import settings
from app.core.deps import (
    _fetch_user_roles,
    get_bearer_token,
    get_current_user,
    require_admin,
    require_self_or_admin,
)

USER_ID = "11111111-1111-1111-1111-111111111111"


def _make_token(sub: str = USER_ID, **extra) -> str:
    payload = {"sub": sub, **extra}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _request_with_path_params(params: dict) -> Request:
    scope = {"type": "http", "path_params": params, "headers": [], "client": None}
    return Request(scope)


class TestGetBearerToken:
    def test_returns_token_when_credentials_present(self):
        assert get_bearer_token(_creds("abc123")) == "abc123"

    def test_raises_401_when_no_credentials(self):
        with pytest.raises(HTTPException) as exc_info:
            get_bearer_token(None)
        assert exc_info.value.status_code == 401


class TestFetchUserRoles:
    def test_returns_roles_on_200(self):
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"roles": ["admin"]}
        with patch("httpx.get", return_value=mock_response):
            assert _fetch_user_roles(USER_ID) == ["admin"]

    def test_returns_empty_list_on_non_200(self):
        mock_response = MagicMock(status_code=404)
        with patch("httpx.get", return_value=mock_response):
            assert _fetch_user_roles(USER_ID) == []

    def test_returns_empty_list_on_request_error(self):
        with patch("httpx.get", side_effect=httpx.RequestError("boom")):
            assert _fetch_user_roles(USER_ID) == []


class TestGetCurrentUser:
    def test_raises_401_when_no_credentials(self):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(None)
        assert exc_info.value.status_code == 401

    def test_raises_401_on_invalid_token(self):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(_creds("not-a-valid-jwt"))
        assert exc_info.value.status_code == 401

    def test_returns_payload_with_roles_on_valid_token(self):
        token = _make_token()
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {"roles": ["admin"]}
        with patch("httpx.get", return_value=mock_response):
            payload = get_current_user(_creds(token))
        assert payload["sub"] == USER_ID
        assert payload["roles"] == ["admin"]


class TestRequireAdmin:
    def test_returns_user_when_admin_role_present(self):
        user = {"sub": USER_ID, "roles": ["admin"]}
        assert require_admin(user) == user

    def test_raises_403_when_admin_role_absent(self):
        user = {"sub": USER_ID, "roles": ["client"]}
        with pytest.raises(HTTPException) as exc_info:
            require_admin(user)
        assert exc_info.value.status_code == 403


class TestRequireSelfOrAdmin:
    def test_allows_self(self):
        user = {"sub": USER_ID, "roles": []}
        request = _request_with_path_params({"user_id": USER_ID})
        assert require_self_or_admin(request, user) == user

    def test_allows_admin_for_other_user(self):
        user = {"sub": "other-id", "roles": ["admin"]}
        request = _request_with_path_params({"user_id": USER_ID})
        assert require_self_or_admin(request, user) == user

    def test_raises_403_for_non_self_non_admin(self):
        user = {"sub": "other-id", "roles": ["client"]}
        request = _request_with_path_params({"user_id": USER_ID})
        with pytest.raises(HTTPException) as exc_info:
            require_self_or_admin(request, user)
        assert exc_info.value.status_code == 403

    def test_allows_when_no_resource_id_in_path(self):
        user = {"sub": USER_ID, "roles": []}
        request = _request_with_path_params({})
        assert require_self_or_admin(request, user) == user
