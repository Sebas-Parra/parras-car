BASE_PERSON = {
    "phone": "0991234567",
    "address": "Calle Falsa 123",
    "nationality": "Ecuatoriana",
    "password": "Password123",
}


def test_create_person_with_user(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000017",
            "first_name": "Pepe",
            "middle_name": "Mario",
            "last_name": "Diaz",
            "email": "pepe@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["cedula"] == "1710000017"
    assert body["user"]["username"] == "pmdiaz"
    assert body["id"] == body["user"]["id_person"]
    assert body["email"] == "pepe@example.com"


def test_create_person_with_user_generates_sequential_username(client, role_ids):
    payload = {
        **BASE_PERSON,
        "cedula": "1710000025",
        "first_name": "Pepe",
        "middle_name": "Mario",
        "last_name": "Diaz",
        "email": "pepe@example.com",
        "role_ids": [role_ids["estudiante"]],
    }
    first_response = client.post("/persons", json=payload)
    assert first_response.status_code == 201
    assert first_response.json()["user"]["username"] == "pmdiaz"

    payload["cedula"] = "1710000033"
    payload["email"] = "pedro@example.com"
    payload["first_name"] = "Pedro"
    payload["middle_name"] = "Marco"
    second_response = client.post("/persons", json=payload)
    assert second_response.status_code == 201
    assert second_response.json()["user"]["username"] == "pmdiaz1"

    payload["cedula"] = "1710000041"
    payload["email"] = "carlos@example.com"
    payload["first_name"] = "Carlos"
    payload["middle_name"] = "Mendez"
    payload["last_name"] = "Diaz"
    third_response = client.post("/persons", json=payload)
    assert third_response.status_code == 201
    assert third_response.json()["user"]["username"] == "cmdiaz"


def test_create_person_requires_middle_name(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000058",
            "first_name": "Pepe",
            "last_name": "Diaz",
            "email": "pepe2@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_rejects_invalid_cedula_length(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "12345",
            "first_name": "Pepe",
            "middle_name": "Mario",
            "last_name": "Diaz",
            "email": "invalidcedula@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_rejects_invalid_cedula_algorithm(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1714863161",  # dígito verificador correcto es 2, no 1
            "first_name": "Test",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "algorithm@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_accepts_valid_ruc(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000017001",  # cédula válida + establecimiento 001
            "first_name": "Ruc",
            "middle_name": "Natural",
            "last_name": "Person",
            "email": "ruc@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 201
    assert response.json()["cedula"] == "1710000017001"


def test_create_person_rejects_ruc_with_invalid_cedula(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1714863161001",  # dígito verificador de la cédula incorrecto
            "first_name": "Bad",
            "middle_name": "Ruc",
            "last_name": "Person",
            "email": "badruc@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_rejects_invalid_cedula_province(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "9900000009",  # provincia 99 no existe
            "first_name": "Test",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "province@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_rejects_names_outside_2_to_50_chars(client, role_ids):
    response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "2222222222",
            "first_name": "A",
            "middle_name": "Mario",
            "last_name": "B" * 51,
            "email": "invalidname@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    assert response.status_code == 422


def test_create_person_duplicate_cedula(client, role_ids):
    payload = {
        **BASE_PERSON,
        "cedula": "1710000066",
        "first_name": "Dup",
        "middle_name": "User",
        "last_name": "User",
        "email": "dup1@example.com",
        "role_ids": [role_ids["estudiante"]],
    }
    client.post("/persons", json=payload)

    payload["email"] = "dup2@example.com"
    response = client.post("/persons", json=payload)
    assert response.status_code == 409


def test_list_persons(client):
    response = client.get("/persons")
    assert response.status_code == 200
    assert any(person["cedula"] == "0000000000" for person in response.json())


def test_update_person(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000074",
            "first_name": "Update",
            "middle_name": "Me",
            "last_name": "Me",
            "email": "updateme@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    response = client.put(f"/persons/{person_id}", json={"phone": "0991234567"})
    assert response.status_code == 200
    assert response.json()["phone"] == "0991234567"


def test_deactivate_person_cascades_to_user(client, db_session, role_ids):
    from app.entities.user import User

    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000082",
            "first_name": "Cascade",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "cascade@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    response = client.patch(f"/persons/{person_id}/deactivate")
    assert response.status_code == 200
    assert response.json()["active"] is False

    from uuid import UUID
    user = db_session.query(User).filter(User.id_person == UUID(person_id)).one()
    assert user.active is False


def test_activate_person_does_not_reactivate_user(client, db_session, role_ids):
    from app.entities.user import User

    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1010101010",
            "first_name": "Reactivate",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "reactivate@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    client.patch(f"/persons/{person_id}/deactivate")
    response = client.patch(f"/persons/{person_id}/activate")

    assert response.status_code == 200
    assert response.json()["active"] is True

    from uuid import UUID
    user = db_session.query(User).filter(User.id_person == UUID(person_id)).one()
    assert user.active is False
