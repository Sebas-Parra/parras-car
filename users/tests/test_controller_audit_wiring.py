"""HTTP-level tests proving the controller correctly extracts current_user
from the real JWT dependency injection and passes it through to the
service-layer audit publishing, instead of relying only on hand-built
current_user dicts (as the Plan 3 service-level tests do).

Note: these tests have the admin update their *own* person/user record
(the "self" branch of require_self_or_admin) rather than someone else's
(the "admin role" branch). That's a deliberate, narrow choice: the seeded
`administrador` role name in this fixture predates the app's later
admin/root role rename (see alembic/versions/0004_update_roles_and_root_user.py),
so `app.core.deps._ADMIN_ROLES = {"admin", "root"}` does not recognize it and
the admin-role branch 403s under this fixture. That mismatch is a pre-existing
test-fixture/naming inconsistency, separate from — and out of scope for — the
current_user wiring this test targets, since the self-match branch already
proves the controller pulls the real JWT payload through Depends() and hands
it to the service unmodified.
"""

from unittest.mock import patch

from app.entities.user import User


def _admin_person_id(db_session) -> str:
    # Read the fixture's seeded admin directly from the DB rather than via an
    # admin-only endpoint (GET /persons, GET /users) — those require the
    # `admin`/`root` role names, which the fixture's `administrador` role
    # does not satisfy under app.core.deps._ADMIN_ROLES (a pre-existing,
    # out-of-scope naming mismatch — see module docstring).
    admin_user = db_session.query(User).filter(User.username == "admin").one()
    return str(admin_user.id_person)


@patch("app.services.person_service.publish_audit_event")
def test_update_person_via_http_wires_real_current_user(mock_publish, client, db_session, admin_auth_headers):
    admin_person_id = _admin_person_id(db_session)

    response = client.put(
        f"/persons/{admin_person_id}",
        json={"phone": "0987654321"},
        headers=admin_auth_headers,
    )

    assert response.status_code == 200, response.text
    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.user_service.publish_audit_event")
def test_update_user_via_http_wires_real_current_user(mock_publish, client, db_session, admin_auth_headers):
    admin_person_id = _admin_person_id(db_session)

    response = client.put(
        f"/users/{admin_person_id}",
        json={"username": "admin"},
        headers=admin_auth_headers,
    )

    assert response.status_code == 200, response.text
    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"
