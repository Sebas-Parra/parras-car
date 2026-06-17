from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.dto.person import PersonBase, PersonRead
from app.dto.role import RoleRead


class UserCreate(PersonBase):
    middle_name: str
    email: EmailStr | None = None
    password: str = Field(min_length=8)
    role_ids: list[UUID] = Field(min_length=1)


class UserUpdate(BaseModel):
    username: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_person: UUID
    username: str
    active: bool
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime
    roles: list[RoleRead] = []


class PersonWithUserRead(PersonRead):
    user: UserRead | None = None
