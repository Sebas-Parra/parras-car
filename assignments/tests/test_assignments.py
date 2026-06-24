from unittest.mock import patch

from tests.conftest import USER_ID, VEHICLE_ID, VEHICLE_ID_2

MOCK_USER = {"id_person": USER_ID, "username": "testuser", "active": True}
MOCK_VEHICLE = {
    "id": VEHICLE_ID,
    "plate": "ABC123",
    "brand": "Toyota",
    "model": "Corolla",
    "color": "Blanco",
    "year": 2022,
    "clasification": "GASOLINE",
    "tipo": "car",
}
MOCK_VEHICLE_2 = {**MOCK_VEHICLE, "id": VEHICLE_ID_2, "plate": "XYZ999"}


class TestHealth:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestCreateAssignment:
    def test_create_assignment_success(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.post(
                "/assignments",
                json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == USER_ID
        assert data["vehicle_id"] == VEHICLE_ID
        assert data["active"] is True

    def test_create_assignment_user_not_found(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=None),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.post(
                "/assignments",
                json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID},
            )
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_create_assignment_vehicle_not_found(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=None),
        ):
            response = client.post(
                "/assignments",
                json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID},
            )
        assert response.status_code == 404
        assert "Vehicle not found" in response.json()["detail"]

    def test_create_duplicate_assignment_fails(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 409

    def test_vehicle_cannot_have_two_active_owners(self, client):
        other_user = "44444444-4444-4444-4444-444444444444"
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            response = client.post("/assignments", json={"user_id": other_user, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 409
        assert "already assigned to another active owner" in response.json()["detail"]


class TestDeleteAssignment:
    def test_delete_assignment_success(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        response = client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")
        assert response.status_code == 200
        assert response.json()["active"] is False

    def test_delete_nonexistent_assignment(self, client):
        response = client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")
        assert response.status_code == 404


class TestAudit:
    def test_audit_created_on_assignment(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        response = client.get("/assignments/audit")
        assert response.status_code == 200
        audits = response.json()
        assert len(audits) == 1
        assert audits[0]["action"] == "CREACION"
        assert audits[0]["user_id"] == USER_ID
        assert audits[0]["vehicle_id"] == VEHICLE_ID

    def test_audit_on_delete(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")

        response = client.get(f"/assignments/{USER_ID}/{VEHICLE_ID}/audit")
        assert response.status_code == 200
        audits = response.json()
        actions = [a["action"] for a in audits]
        assert "CREACION" in actions
        assert "ELIMINACION" in actions

    def test_audit_on_reactivation(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        response = client.get(f"/assignments/{USER_ID}/{VEHICLE_ID}/audit")
        audits = response.json()
        actions = [a["action"] for a in audits]
        assert "MODIFICACION" in actions


class TestFleet:
    def test_get_fleet(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        with patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE):
            response = client.get(f"/assignments/{USER_ID}/fleet")

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == USER_ID
        assert data["total"] == 1
        assert data["vehicles"][0]["plate"] == "ABC123"
        assert data["vehicles"][0]["clasification"] == "GASOLINE"

    def test_get_fleet_empty(self, client):
        response = client.get(f"/assignments/{USER_ID}/fleet")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["vehicles"] == []
