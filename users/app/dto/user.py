from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.dto.person import PersonBase, PersonRead, _ADDRESS_REGEX, _NAME_REGEX, _validate_ecuadorian_id, _validate_name
from app.dto.role import RoleRead


class UserCreate(PersonBase):
    """Datos para el registro de un nuevo cliente.

    El rol 'cliente' se asigna automáticamente — el usuario no elige su rol.
    """

    password: str = Field(min_length=8)

    @field_validator("cedula", mode="after")
    @classmethod
    def validate_cedula(cls, v: str) -> str:
        return _validate_ecuadorian_id(v)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La contraseña no puede contener solo espacios")
        return v

    @field_validator("nationality", mode="before")
    @classmethod
    def validate_nationality(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("La nacionalidad no puede contener solo espacios")
        if not _NAME_REGEX.match(v.strip()):
            raise ValueError("La nacionalidad no puede contener números ni caracteres especiales")
        return v.strip()

    @field_validator("address", mode="before")
    @classmethod
    def validate_address(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("La dirección no puede contener solo espacios")
        if not _ADDRESS_REGEX.match(v):
            raise ValueError(
                "La dirección solo puede contener letras, números, espacios y los caracteres: , . - # / ( )"
            )
        return v


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
