def test_create_person_with_user(client, admin_headers, role_ids):
    response = client.post(
        "/persons",
        json={
            "cedula": "3333333333",
            "first_name": "Pepe",
            "middle_name": "Mario",
            "last_name": "Diaz",
            "email": "pepe@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["cedula"] == "3333333333"
    assert body["user"]["username"] == "pmdiaz"
    assert body["id"] == body["user"]["id_person"]
    assert body["email"] == "pmdiaz@parras-car.com"


def test_create_person_with_user_generates_sequential_username(client, admin_headers, role_ids):
    payload = {
        "cedula": "4444444444",
        "first_name": "Pepe",
        "middle_name": "Mario",
        "last_name": "Diaz",
        "email": "pepe@example.com",
        "password": "Password123",
        "role_ids": [role_ids["estudiante"]],
    }
    first_response = client.post("/persons", json=payload, headers=admin_headers)
    assert first_response.status_code == 201
    assert first_response.json()["user"]["username"] == "pmdiaz"

    payload["cedula"] = "4444444445"
    payload["email"] = "pedro@example.com"
    payload["first_name"] = "Pedro"
    payload["middle_name"] = "Marco"
    second_response = client.post("/persons", json=payload, headers=admin_headers)
    assert second_response.status_code == 201
    assert second_response.json()["user"]["username"] == "pmdiaz1"

    payload["cedula"] = "4444444446"
    payload["email"] = "carlos@example.com"
    payload["first_name"] = "Carlos"
    payload["middle_name"] = "Mendez"
    payload["last_name"] = "Diaz"
    third_response = client.post("/persons", json=payload, headers=admin_headers)
    assert third_response.status_code == 201
    assert third_response.json()["user"]["username"] == "cmdiaz"


def test_create_person_requires_middle_name(client, admin_headers, role_ids):
    response = client.post(
        "/persons",
        json={
            "cedula": "5555555555",
            "first_name": "Pepe",
            "last_name": "Diaz",
            "email": "pepe2@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_create_person_rejects_invalid_cedula_length(client, admin_headers, role_ids):
    response = client.post(
        "/persons",
        json={
            "cedula": "12345",
            "first_name": "Pepe",
            "middle_name": "Mario",
            "last_name": "Diaz",
            "email": "invalidcedula@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_create_person_rejects_names_outside_2_to_50_chars(client, admin_headers, role_ids):
    response = client.post(
        "/persons",
        json={
            "cedula": "2222222222",
            "first_name": "A",
            "middle_name": "Mario",
            "last_name": "B" * 51,
            "email": "invalidname@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_create_person_duplicate_cedula(client, admin_headers, role_ids):
    payload = {
        "cedula": "4444444444",
        "first_name": "Dup",
        "middle_name": "User",
        "last_name": "User",
        "email": "dup1@example.com",
        "password": "Password123",
        "role_ids": [role_ids["estudiante"]],
    }
    client.post("/persons", json=payload, headers=admin_headers)

    payload["email"] = "dup2@example.com"
    response = client.post("/persons", json=payload, headers=admin_headers)
    assert response.status_code == 409


def test_create_person_requires_admin(client, role_ids):
    response = client.post(
        "/persons",
        json={
            "cedula": "5555555555",
            "first_name": "No",
            "middle_name": "Admin",
            "last_name": "Admin",
            "email": "noadmin@example.com",
            "password": "Password123",
            "role_ids": [role_ids["visitante"]],
        },
    )
    assert response.status_code == 401


def test_list_persons_requires_admin(client, admin_headers):
    response = client.get("/persons", headers=admin_headers)
    assert response.status_code == 200
    assert any(person["cedula"] == "0000000000" for person in response.json())


def test_get_own_person(client, admin_headers):
    me_response = client.get("/auth/me", headers=admin_headers)
    person_id = me_response.json()["id"]

    response = client.get(f"/persons/{person_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["id"] == person_id


def test_update_person(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "9999999999",
            "first_name": "Update",
            "middle_name": "Me",
            "last_name": "Me",
            "email": "updateme@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.put(
        f"/persons/{person_id}",
        json={"phone": "0991234567"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["phone"] == "0991234567"


def test_deactivate_person_cascades_to_user(client, admin_headers, db_session, role_ids):
    from app.models.user import User

    create_response = client.post(
        "/persons",
        json={
            "cedula": "6666666666",
            "first_name": "Cascade",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "cascade@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.patch(f"/persons/{person_id}/deactivate", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["active"] is False

    user = db_session.query(User).filter(User.id_person == person_id).one()
    assert user.active is False


def test_activate_person_does_not_reactivate_user(client, admin_headers, db_session, role_ids):
    from app.models.user import User

    create_response = client.post(
        "/persons",
        json={
            "cedula": "1010101010",
            "first_name": "Reactivate",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "reactivate@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    client.patch(f"/persons/{person_id}/deactivate", headers=admin_headers)
    response = client.patch(f"/persons/{person_id}/activate", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["active"] is True

    user = db_session.query(User).filter(User.id_person == person_id).one()
    assert user.active is False


def test_deactivate_person_requires_admin(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1212121212",
            "first_name": "Self",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "selftest@example.com",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    login_response = client.post("/auth/login", data={"username": "sttest", "password": "Password123"})
    self_token = login_response.json()["access_token"]
    self_headers = {"Authorization": f"Bearer {self_token}"}

    response = client.patch(f"/persons/{person_id}/deactivate", headers=self_headers)
    assert response.status_code == 403
