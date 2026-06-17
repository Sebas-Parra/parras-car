from pydantic import BaseModel, ConfigDict


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class RoleAssign(BaseModel):
    role_id: int
