from unittest.mock import patch

from tests.conftest import USER_ID, VEHICLE_ID, VEHICLE_ID_2

NEW_USER_ID = "55555555-5555-5555-5555-555555555555"
MOCK_NEW_USER = {"id_person": NEW_USER_ID, "username": "newowner", "active": True}

MOCK_USER = {"id_person": USER_ID, "username": "testuser", "active": True}
MOCK_INACTIVE_USER = {**MOCK_USER, "active": False}
MOCK_VEHICLE = {
    "id": VEHICLE_ID,
    "plate": "ABC123",
    "brand": "Toyota",
    "model": "Corolla",
    "color": "Blanco",
    "year": 2022,
    "clasification": "GASOLINE",
    "active": True,
    "tipo": "car",
}
MOCK_INACTIVE_VEHICLE = {**MOCK_VEHICLE, "active": False}
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

    def test_create_assignment_invalid_uuid(self, client):
        response = client.post(
            "/assignments",
            json={"user_id": "not-a-uuid", "vehicle_id": VEHICLE_ID},
        )
        assert response.status_code == 422

    def test_create_assignment_user_not_found(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=None),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_create_assignment_inactive_user_rejected(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_INACTIVE_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 409
        assert "not active" in response.json()["detail"]

    def test_create_assignment_vehicle_not_found(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=None),
        ):
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 404
        assert "Vehicle not found" in response.json()["detail"]

    def test_create_assignment_inactive_vehicle_rejected(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_INACTIVE_VEHICLE),
        ):
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
        assert response.status_code == 409
        assert "not active" in response.json()["detail"]

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


    def test_create_assignment_reactivates_inactive_relation(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")
            response = client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        assert response.status_code == 201
        assert response.json()["active"] is True


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

    def test_delete_inactive_assignment_returns_not_found(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")

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


    def test_assignment_audit_is_filtered_by_user_and_vehicle(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", side_effect=[MOCK_VEHICLE, MOCK_VEHICLE_2]),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID_2})

        response = client.get(f"/assignments/{USER_ID}/{VEHICLE_ID}/audit")

        assert response.status_code == 200
        audits = response.json()
        assert len(audits) == 1
        assert audits[0]["user_id"] == USER_ID
        assert audits[0]["vehicle_id"] == VEHICLE_ID


class TestTransfer:
    def _create_assignment(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

    def test_transfer_success(self, client):
        self._create_assignment(client)

        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == NEW_USER_ID
        assert data["vehicle_id"] == VEHICLE_ID
        assert data["active"] is True

    def test_transfer_records_modificacion_audit(self, client):
        self._create_assignment(client)

        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )

        response = client.get("/assignments/audit")
        actions = [a["action"] for a in response.json()]
        assert "MODIFICACION" in actions
        assert "ELIMINACION" in actions
        assert "CREACION" in actions

    def test_transfer_modificacion_has_correct_data(self, client):
        self._create_assignment(client)

        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )

        audits = client.get("/assignments/audit").json()
        modificacion = next(a for a in audits if a["action"] == "MODIFICACION")
        assert modificacion["previous_data"]["user_id"] == USER_ID
        assert modificacion["new_data"]["user_id"] == NEW_USER_ID
        assert modificacion["previous_data"]["active"] is True
        assert modificacion["new_data"]["active"] is True

    def test_transfer_fails_if_no_active_assignment(self, client):
        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )
        assert response.status_code == 404

    def test_transfer_to_self_rejected(self, client):
        self._create_assignment(client)
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": USER_ID},
            )
        assert response.status_code == 409
        assert "different users" in response.json()["detail"]

    def test_transfer_inactive_destination_user_rejected(self, client):
        self._create_assignment(client)
        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_INACTIVE_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )
        assert response.status_code == 409
        assert "not active" in response.json()["detail"]

    def test_transfer_inactive_vehicle_rejected(self, client):
        self._create_assignment(client)
        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_INACTIVE_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )
        assert response.status_code == 409

    def test_transfer_to_user_who_previously_had_vehicle(self, client):
        """to_user had this vehicle before (inactive row) — must not cause PK violation."""
        # New user had vehicle, then it was transferred away
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_NEW_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": NEW_USER_ID, "vehicle_id": VEHICLE_ID})

        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_NEW_USER, MOCK_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": NEW_USER_ID, "to_user_id": USER_ID},
            )

        # Now transfer back to new_user — who has an inactive row
        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            response = client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )
        assert response.status_code == 200
        assert response.json()["user_id"] == NEW_USER_ID
        assert response.json()["active"] is True

    def test_transfer_old_owner_loses_vehicle(self, client):
        self._create_assignment(client)

        with (
            patch("app.services.vehicles_client.get_user", side_effect=[MOCK_USER, MOCK_NEW_USER]),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.patch(
                f"/assignments/{VEHICLE_ID}/transfer",
                json={"from_user_id": USER_ID, "to_user_id": NEW_USER_ID},
            )

        with patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE):
            old_fleet = client.get(f"/assignments/{USER_ID}/fleet").json()
            new_fleet = client.get(f"/assignments/{NEW_USER_ID}/fleet").json()

        assert old_fleet["total"] == 0
        assert new_fleet["total"] == 1


class TestByVehicle:
    def test_returns_assignment_when_vehicle_is_assigned(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        response = client.get(f"/assignments/by-vehicle/{VEHICLE_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["vehicle_id"] == VEHICLE_ID
        assert data["user_id"] == USER_ID
        assert data["active"] is True

    def test_returns_404_when_vehicle_has_no_active_assignment(self, client):
        response = client.get(f"/assignments/by-vehicle/{VEHICLE_ID}")
        assert response.status_code == 404
        assert "safe to delete" in response.json()["detail"]

    def test_returns_404_after_assignment_is_deleted(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        client.delete(f"/assignments/{USER_ID}/{VEHICLE_ID}")

        response = client.get(f"/assignments/by-vehicle/{VEHICLE_ID}")
        assert response.status_code == 404


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

    def test_get_fleet_uses_type_when_tipo_is_missing(self, client):
        vehicle = {**MOCK_VEHICLE, "tipo": None, "type": "car"}
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=vehicle),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        with patch("app.services.vehicles_client.get_vehicle", return_value=vehicle):
            response = client.get(f"/assignments/{USER_ID}/fleet")

        assert response.status_code == 200
        assert response.json()["vehicles"][0]["tipo"] == "car"

    def test_get_fleet_skips_vehicle_details_when_vehicle_service_has_no_data(self, client):
        with (
            patch("app.services.vehicles_client.get_user", return_value=MOCK_USER),
            patch("app.services.vehicles_client.get_vehicle", return_value=MOCK_VEHICLE),
        ):
            client.post("/assignments", json={"user_id": USER_ID, "vehicle_id": VEHICLE_ID})

        with patch("app.services.vehicles_client.get_vehicle", return_value=None):
            response = client.get(f"/assignments/{USER_ID}/fleet")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["vehicles"] == []

    def test_get_fleet_empty(self, client):
        response = client.get(f"/assignments/{USER_ID}/fleet")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["vehicles"] == []
