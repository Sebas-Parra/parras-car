BASE_PERSON = {
    "phone": "0991234567",
    "address": "Calle Falsa 123",
    "nationality": "Ecuatoriana",
    "password": "Password123",
}


def test_list_users(client):
    response = client.get("/users")
    assert response.status_code == 200
    assert any(user["username"] == "admin" for user in response.json())


def test_update_user_username(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000090",
            "first_name": "Update",
            "middle_name": "Username",
            "last_name": "Username",
            "email": "updateuser@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    response = client.put(f"/users/{person_id}", json={"username": "newusername"})
    assert response.status_code == 200
    assert response.json()["username"] == "newusername"


def test_update_user_duplicate_username(client, role_ids):
    client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1414141414",
            "first_name": "First",
            "middle_name": "User",
            "last_name": "User",
            "email": "firstuser@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000108",
            "first_name": "Second",
            "middle_name": "User",
            "last_name": "User",
            "email": "seconduser@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    # "fuuser" is the auto-generated username of the first user (First User User)
    response = client.put(f"/users/{person_id}", json={"username": "fuuser"})
    assert response.status_code == 409


def test_activate_user_blocked_when_person_inactive(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000116",
            "first_name": "Block",
            "middle_name": "Activate",
            "last_name": "Activate",
            "email": "block@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    client.patch(f"/persons/{person_id}/deactivate")

    response = client.patch(f"/users/{person_id}/activate")
    assert response.status_code == 409


def test_deactivate_and_activate_user(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1616161616",
            "first_name": "Toggle",
            "middle_name": "User",
            "last_name": "User",
            "email": "toggleuser@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    deactivate_response = client.patch(f"/users/{person_id}/deactivate")
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["active"] is False

    activate_response = client.patch(f"/users/{person_id}/activate")
    assert activate_response.status_code == 200
    assert activate_response.json()["active"] is True


def test_assign_and_remove_role(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000124",
            "first_name": "Role",
            "middle_name": "Test",
            "last_name": "Test",
            "email": "roletest@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    assign_response = client.post(
        f"/users/{person_id}/roles",
        json={"role_id": role_ids["profesor"]},
    )
    assert assign_response.status_code == 200
    role_names = {role["name"] for role in assign_response.json()["roles"]}
    assert role_names == {"estudiante", "profesor"}

    remove_response = client.delete(f"/users/{person_id}/roles/{role_ids['profesor']}")
    assert remove_response.status_code == 200
    role_names = {role["name"] for role in remove_response.json()["roles"]}
    assert role_names == {"estudiante"}


def test_assign_duplicate_role(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1710000132",
            "first_name": "Duplicate",
            "middle_name": "Role",
            "last_name": "Role",
            "email": "duprole@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    response = client.post(
        f"/users/{person_id}/roles",
        json={"role_id": role_ids["estudiante"]},
    )
    assert response.status_code == 409


def test_remove_role_not_assigned(client, role_ids):
    create_response = client.post(
        "/persons",
        json={
            **BASE_PERSON,
            "cedula": "1818181818",
            "first_name": "NoRole",
            "middle_name": "Remove",
            "last_name": "Remove",
            "email": "norole@example.com",
            "role_ids": [role_ids["estudiante"]],
        },
    )
    person_id = create_response.json()["id"]

    response = client.delete(f"/users/{person_id}/roles/{role_ids['profesor']}")
    assert response.status_code == 404
