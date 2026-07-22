"""HTTP-level tests proving the controller correctly extracts current_user
from the real JWT dependency injection and passes it through to the
service-layer audit publishing, instead of relying only on hand-built
current_user dicts (as the Plan 3 service-level tests do).

These tests use two genuinely distinct identities: a freshly seeded "actor"
user (with a role that satisfies app.core.deps._ADMIN_ROLES = {"admin",
"root"}) performs the request against the fixture's separately seeded admin
person/user record as the *target*. Actor != target is deliberate: if the
controller ever regressed to sourcing usuario/rol from the target resource
being modified instead of from current_user (the real JWT payload), a test
where the actor updates their own record could not tell the difference —
both would read the same row. Using a distinct actor means the test can only
pass if the published event's usuario/rol match the actor's JWT identity.
"""

from unittest.mock import patch

from app.entities.person import Person
from app.entities.role import Role
from app.entities.user import User
from app.utils.security import create_access_token, hash_password


def _seed_actor(db_session, *, username: str, role_name: str, cedula: str, email: str) -> User:
    """Seed a second identity, distinct from the fixture's admin, holding a
    role that satisfies app.core.deps._ADMIN_ROLES, so it's authorized to act
    on someone else's person/user record via require_self_or_admin.
    """
    role = db_session.query(Role).filter(Role.name == role_name).first()
    if role is None:
        role = Role(name=role_name, description=role_name.capitalize())
        db_session.add(role)
        db_session.flush()

    person = Person(cedula=cedula, first_name="Wiring", last_name="Actor", email=email)
    db_session.add(person)
    db_session.flush()

    user = User(id_person=person.id, username=username, password_hash=hash_password("Password123!"))
    user.roles.append(role)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers_for(user: User) -> dict:
    roles = [role.name for role in user.roles]
    token = create_access_token(user_id=str(user.id_person), username=user.username, roles=roles)
    return {"Authorization": f"Bearer {token}"}


def _target_person_id(db_session) -> str:
    # The fixture's seeded admin — used here purely as *someone else's*
    # record, distinct from the actor performing the request.
    target = db_session.query(User).filter(User.username == "admin").one()
    return str(target.id_person)


@patch("app.services.person_service.publish_audit_event")
def test_update_person_via_http_wires_real_current_user(mock_publish, client, db_session):
    actor = _seed_actor(
        db_session,
        username="wiring_actor_person",
        role_name="admin",
        cedula="1710000066",
        email="wiring.actor.person@example.com",
    )
    target_person_id = _target_person_id(db_session)

    response = client.put(
        f"/persons/{target_person_id}",
        json={"phone": "0987654321"},
        headers=_auth_headers_for(actor),
    )

    assert response.status_code == 200, response.text
    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["usuario"] == actor.username
    assert kwargs["rol"] == actor.roles[0].name


@patch("app.services.user_service.publish_audit_event")
def test_update_user_via_http_wires_real_current_user(mock_publish, client, db_session):
    actor = _seed_actor(
        db_session,
        username="wiring_actor_user",
        role_name="admin",
        cedula="1710000074",
        email="wiring.actor.user@example.com",
    )
    target_person_id = _target_person_id(db_session)

    response = client.put(
        f"/users/{target_person_id}",
        json={"username": "admin_renamed"},
        headers=_auth_headers_for(actor),
    )

    assert response.status_code == 200, response.text
    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["usuario"] == actor.username
    assert kwargs["rol"] == actor.roles[0].name
