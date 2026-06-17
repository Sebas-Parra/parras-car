from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.person import PersonBase, PersonRead
from app.schemas.role import RoleRead


class UserCreate(PersonBase):
    password: str = Field(min_length=8)
    role_ids: list[int] = Field(min_length=1)


class UserUpdate(BaseModel):
    username: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_person: int
    username: str
    active: bool
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime
    roles: list[RoleRead] = []


class PersonWithUserRead(PersonRead):
    user: UserRead | None = None
