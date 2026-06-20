from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.dto.person import PersonBase, PersonRead, _NAME_REGEX, _PHONE_REGEX, _validate_name
from app.dto.role import RoleRead


class UserCreate(PersonBase):
    middle_name: str = Field(min_length=2, max_length=50)
    phone: str
    address: str
    nationality: str
    password: str = Field(min_length=8)
    role_ids: list[UUID] = Field(min_length=1)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La contraseña no puede contener solo espacios")
        return v

    @field_validator("middle_name", mode="before")
    @classmethod
    def validate_middle_name(cls, v: str) -> str:
        return _validate_name(v, "El segundo nombre")

    @field_validator("nationality", mode="before")
    @classmethod
    def validate_nationality(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La nacionalidad no puede contener solo espacios")
        if not _NAME_REGEX.match(v.strip()):
            raise ValueError("La nacionalidad no puede contener números ni caracteres especiales")
        return v.strip()

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El teléfono no puede contener solo espacios")
        if not _PHONE_REGEX.match(v.strip()):
            raise ValueError("El teléfono solo puede contener dígitos, espacios y los caracteres: + - ( )")
        return v.strip()

    @field_validator("address", mode="before")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La dirección no puede contener solo espacios")
        return v.strip()


class UserUpdate(BaseModel):
    username: str | None = None

    @field_validator("username", mode="before")
    @classmethod
    def no_blank_username(cls, v: str | None) -> str | None:
        if isinstance(v, str) and not v.strip():
            raise ValueError("El nombre de usuario no puede contener solo espacios")
        return v.strip() if isinstance(v, str) else v


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
