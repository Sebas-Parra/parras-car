from app.entities.permission import Permission
from app.entities.person import Person
from app.entities.role import Role
from app.entities.user import User
from app.utils.security import create_access_token, hash_password


def _seed_admin_actor(db_session) -> User:
    """Seed an actor whose role satisfies app.core.deps._ADMIN_ROLES, since the
    conftest fixture's default admin holds the legacy 'administrador' role,
    which no longer authorizes require_admin (only 'admin'/'root' do).
    """
    role = db_session.query(Role).filter(Role.name == "admin").first()
    if role is None:
        role = Role(name="admin", description="Administrador")
        db_session.add(role)
        db_session.flush()

    person = Person(cedula="0000000099", first_name="Perm", last_name="Actor", email="perm-actor@example.com")
    db_session.add(person)
    db_session.flush()

    user = User(id_person=person.id, username="perm-actor", password_hash=hash_password("Password123!"))
    user.roles.append(role)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers_for(user: User) -> dict:
    token = create_access_token(user_id=str(user.id_person), username=user.username, roles=[])
    return {"Authorization": f"Bearer {token}"}


def _seed_permissions(db_session) -> dict[str, str]:
    perms = [
        Permission(name="publico", description="Acceso público", is_public=True),
        Permission(name="gestionar_zonas", description="Gestionar zonas", is_public=False),
        Permission(name="gestionar_usuarios", description="Gestionar usuarios", is_public=False),
    ]
    db_session.add_all(perms)
    db_session.commit()
    return {p.name: str(p.id) for p in perms}


def test_list_permissions_returns_catalog(client, db_session):
    actor = _seed_admin_actor(db_session)
    perm_ids = _seed_permissions(db_session)

    response = client.get("/permissions", headers=_auth_headers_for(actor))

    assert response.status_code == 200
    names = {p["name"] for p in response.json()}
    assert names == set(perm_ids.keys())


def test_create_role_without_permission_ids_defaults_to_public_only(client, db_session):
    actor = _seed_admin_actor(db_session)
    _seed_permissions(db_session)

    response = client.post(
        "/roles",
        json={"name": "soporte", "description": "Soporte técnico"},
        headers=_auth_headers_for(actor),
    )

    assert response.status_code == 201
    body = response.json()
    assert [p["name"] for p in body["permissions"]] == ["publico"]


def test_create_role_with_explicit_permission_ids(client, db_session):
    actor = _seed_admin_actor(db_session)
    perm_ids = _seed_permissions(db_session)

    response = client.post(
        "/roles",
        json={
            "name": "soporte",
            "description": "Soporte técnico",
            "permission_ids": [perm_ids["publico"], perm_ids["gestionar_zonas"]],
        },
        headers=_auth_headers_for(actor),
    )

    assert response.status_code == 201
    names = {p["name"] for p in response.json()["permissions"]}
    assert names == {"publico", "gestionar_zonas"}


def test_create_role_with_unknown_permission_id_fails(client, db_session):
    actor = _seed_admin_actor(db_session)
    _seed_permissions(db_session)

    response = client.post(
        "/roles",
        json={"name": "soporte", "permission_ids": ["00000000-0000-0000-0000-000000000000"]},
        headers=_auth_headers_for(actor),
    )

    assert response.status_code == 400


def test_update_role_replaces_permission_set(client, db_session):
    actor = _seed_admin_actor(db_session)
    perm_ids = _seed_permissions(db_session)

    create_response = client.post(
        "/roles",
        json={"name": "soporte", "permission_ids": [perm_ids["publico"]]},
        headers=_auth_headers_for(actor),
    )
    role_id = create_response.json()["id"]

    update_response = client.put(
        f"/roles/{role_id}",
        json={"permission_ids": [perm_ids["gestionar_usuarios"]]},
        headers=_auth_headers_for(actor),
    )

    assert update_response.status_code == 200
    names = {p["name"] for p in update_response.json()["permissions"]}
    assert names == {"gestionar_usuarios"}


def test_update_role_without_permission_ids_leaves_permissions_untouched(client, db_session):
    actor = _seed_admin_actor(db_session)
    perm_ids = _seed_permissions(db_session)

    create_response = client.post(
        "/roles",
        json={"name": "soporte", "permission_ids": [perm_ids["publico"], perm_ids["gestionar_zonas"]]},
        headers=_auth_headers_for(actor),
    )
    role_id = create_response.json()["id"]

    update_response = client.put(
        f"/roles/{role_id}",
        json={"description": "Nueva descripción"},
        headers=_auth_headers_for(actor),
    )

    assert update_response.status_code == 200
    names = {p["name"] for p in update_response.json()["permissions"]}
    assert names == {"publico", "gestionar_zonas"}
