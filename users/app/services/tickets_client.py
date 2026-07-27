import httpx

from app.core.config import settings


def has_active_ticket(user_id: str, token: str) -> bool:
    try:
        response = httpx.get(
            f"{settings.tickets_service_url}/tickets",
            params={"estado": "ACTIVO", "idUsuario": user_id, "pageSize": 1},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if response.status_code != 200:
            return False
        data = response.json()
        return len(data.get("data", [])) > 0
    except httpx.RequestError:
        return False
