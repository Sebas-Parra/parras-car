def test_list_roles(client, admin_auth_headers):
    response = client.get("/roles", headers=admin_auth_headers)
    assert response.status_code == 200
    names = {role["name"] for role in response.json()}
    assert names == {"estudiante", "profesor", "administrador", "visitante", "cliente", "admin", "root"}
