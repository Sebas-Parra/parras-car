def test_list_roles_requires_auth(client):
    response = client.get("/roles")
    assert response.status_code == 401


def test_list_roles_authenticated(client, admin_headers):
    response = client.get("/roles", headers=admin_headers)
    assert response.status_code == 200
    names = {role["name"] for role in response.json()}
    assert names == {"estudiante", "profesor", "administrador", "visitante"}
