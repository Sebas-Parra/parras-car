def test_list_users_requires_admin(client):
    response = client.get("/users")
    assert response.status_code == 401


def test_list_users_as_admin(client, admin_headers):
    response = client.get("/users", headers=admin_headers)
    assert response.status_code == 200
    assert any(user["username"] == "admin" for user in response.json())


def test_get_own_user(client, admin_headers):
    me_response = client.get("/auth/me", headers=admin_headers)
    person_id = me_response.json()["id"]

    response = client.get(f"/users/{person_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_update_user_username(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1313131313",
            "first_name": "Update",
            "last_name": "Username",
            "email": "updateuser@example.com",
            "username": "oldusername",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.put(f"/users/{person_id}", json={"username": "newusername"}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "newusername"


def test_update_user_duplicate_username(client, admin_headers, role_ids):
    client.post(
        "/persons",
        json={
            "cedula": "1414141414",
            "first_name": "First",
            "last_name": "User",
            "email": "firstuser@example.com",
            "username": "firstusername",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1515151515",
            "first_name": "Second",
            "last_name": "User",
            "email": "seconduser@example.com",
            "username": "secondusername",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.put(f"/users/{person_id}", json={"username": "firstusername"}, headers=admin_headers)
    assert response.status_code == 409


def test_activate_user_blocked_when_person_inactive(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "7777777777",
            "first_name": "Block",
            "last_name": "Activate",
            "email": "block@example.com",
            "username": "blockuser",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    client.patch(f"/persons/{person_id}/deactivate", headers=admin_headers)

    response = client.patch(f"/users/{person_id}/activate", headers=admin_headers)
    assert response.status_code == 409


def test_deactivate_and_activate_user(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1616161616",
            "first_name": "Toggle",
            "last_name": "User",
            "email": "toggleuser@example.com",
            "username": "toggleuser",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    deactivate_response = client.patch(f"/users/{person_id}/deactivate", headers=admin_headers)
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["active"] is False

    activate_response = client.patch(f"/users/{person_id}/activate", headers=admin_headers)
    assert activate_response.status_code == 200
    assert activate_response.json()["active"] is True


def test_assign_and_remove_role(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "8888888888",
            "first_name": "Role",
            "last_name": "Test",
            "email": "roletest@example.com",
            "username": "roletester",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    assign_response = client.post(
        f"/users/{person_id}/roles",
        json={"role_id": role_ids["profesor"]},
        headers=admin_headers,
    )
    assert assign_response.status_code == 200
    role_names = {role["name"] for role in assign_response.json()["roles"]}
    assert role_names == {"estudiante", "profesor"}

    remove_response = client.delete(
        f"/users/{person_id}/roles/{role_ids['profesor']}",
        headers=admin_headers,
    )
    assert remove_response.status_code == 200
    role_names = {role["name"] for role in remove_response.json()["roles"]}
    assert role_names == {"estudiante"}


def test_assign_duplicate_role(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1717171717",
            "first_name": "Duplicate",
            "last_name": "Role",
            "email": "duprole@example.com",
            "username": "duproleuser",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.post(
        f"/users/{person_id}/roles",
        json={"role_id": role_ids["estudiante"]},
        headers=admin_headers,
    )
    assert response.status_code == 409


def test_remove_role_not_assigned(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1818181818",
            "first_name": "NoRole",
            "last_name": "Remove",
            "email": "norole@example.com",
            "username": "noroleuser",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    response = client.delete(
        f"/users/{person_id}/roles/{role_ids['profesor']}",
        headers=admin_headers,
    )
    assert response.status_code == 404


def test_assign_role_requires_admin(client, admin_headers, role_ids):
    create_response = client.post(
        "/persons",
        json={
            "cedula": "1919191919",
            "first_name": "NonAdmin",
            "last_name": "Assign",
            "email": "nonadminassign@example.com",
            "username": "nonadminassign",
            "password": "Password123",
            "role_ids": [role_ids["estudiante"]],
        },
        headers=admin_headers,
    )
    person_id = create_response.json()["id"]

    login_response = client.post("/auth/login", data={"username": "nonadminassign", "password": "Password123"})
    self_token = login_response.json()["access_token"]
    self_headers = {"Authorization": f"Bearer {self_token}"}

    response = client.post(
        f"/users/{person_id}/roles",
        json={"role_id": role_ids["profesor"]},
        headers=self_headers,
    )
    assert response.status_code == 403
