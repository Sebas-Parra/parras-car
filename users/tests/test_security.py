from app.utils.security import hash_password, verify_password


def test_hash_password_and_verify():
    hashed = hash_password("Password123")
    assert hashed != "Password123"
    assert verify_password("Password123", hashed) is True
    assert verify_password("WrongPassword", hashed) is False
