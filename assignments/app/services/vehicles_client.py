from uuid import UUID

import httpx

from app.core.config import settings


def get_vehicle(vehicle_id: UUID, token: str) -> dict | None:
    try:
        response = httpx.get(
            f"{settings.vehicles_service_url}/vehicles/{vehicle_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if response.status_code == 200:
            return response.json()
        return None
    except httpx.RequestError:
        return None


def get_user(user_id: UUID, token: str) -> dict | None:
    try:
        response = httpx.get(
            f"{settings.users_service_url}/users/{user_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if response.status_code == 200:
            return response.json()
        return None
    except httpx.RequestError:
        return None
