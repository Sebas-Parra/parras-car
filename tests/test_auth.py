def test_login_success(client):
    response = client.post("/auth/login", data={"username": "admin", "password": "Admin123!"})
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_invalid_password(client):
    response = client.post("/auth/login", data={"username": "admin", "password": "wrong"})
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post("/auth/login", data={"username": "ghost", "password": "whatever"})
    assert response.status_code == 401


def test_refresh_token(client):
    login_response = client.post("/auth/login", data={"username": "admin", "password": "Admin123!"})
    refresh_token = login_response.json()["refresh_token"]

    response = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_refresh_with_access_token_rejected(client):
    login_response = client.post("/auth/login", data={"username": "admin", "password": "Admin123!"})
    access_token = login_response.json()["access_token"]

    response = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401


def test_me_returns_current_user(client, admin_headers):
    response = client.get("/auth/me", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert "administrador" in body["roles"]


def test_me_without_token_rejected(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
