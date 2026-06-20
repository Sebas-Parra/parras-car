from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cedula: str
    first_name: str
    middle_name: str | None = None
    last_name: str
    email: str
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None
    active: bool
    username: str
    roles: list[str] = []
