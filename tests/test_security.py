from app.utils.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password


def test_hash_password_and_verify():
    hashed = hash_password("Password123")
    assert hashed != "Password123"
    assert verify_password("Password123", hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_create_and_decode_access_token():
    token = create_access_token("42", ["administrador"])
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["roles"] == ["administrador"]
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    token = create_refresh_token("42")
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["type"] == "refresh"
