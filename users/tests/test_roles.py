def test_list_roles(client):
    response = client.get("/roles")
    assert response.status_code == 200
    names = {role["name"] for role in response.json()}
    assert names == {"estudiante", "profesor", "administrador", "visitante"}
