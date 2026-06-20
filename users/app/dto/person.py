import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

NAME_FIELD = Field(min_length=2, max_length=50)
OPTIONAL_NAME_FIELD = Field(default=None, min_length=2, max_length=50)

_NAME_REGEX = re.compile(r"^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$")
_PHONE_REGEX = re.compile(r"^[\d\s\+\-\(\)]+$")


def _validate_name(v: str, label: str) -> str:
    if not v.strip():
        raise ValueError(f"{label} no puede contener solo espacios")
    if not _NAME_REGEX.match(v.strip()):
        raise ValueError(f"{label} no puede contener números ni caracteres especiales")
    return v.strip()


class PersonBase(BaseModel):
    cedula: str = Field(pattern=r"^\d{10}$")
    first_name: str = NAME_FIELD
    middle_name: str | None = OPTIONAL_NAME_FIELD
    last_name: str = NAME_FIELD
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str) -> str:
        return _validate_name(v, "El primer nombre")

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str) -> str:
        return _validate_name(v, "El apellido")

    @field_validator("middle_name", mode="before")
    @classmethod
    def validate_middle_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_name(v, "El segundo nombre")


class PersonUpdate(BaseModel):
    first_name: str | None = OPTIONAL_NAME_FIELD
    middle_name: str | None = OPTIONAL_NAME_FIELD
    last_name: str | None = OPTIONAL_NAME_FIELD
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str | None) -> str | None:
        return _validate_name(v, "El primer nombre") if v is not None else v

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str | None) -> str | None:
        return _validate_name(v, "El apellido") if v is not None else v

    @field_validator("middle_name", mode="before")
    @classmethod
    def validate_middle_name(cls, v: str | None) -> str | None:
        return _validate_name(v, "El segundo nombre") if v is not None else v

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

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("El teléfono no puede contener solo espacios")
        if not _PHONE_REGEX.match(v.strip()):
            raise ValueError("El teléfono solo puede contener dígitos, espacios y los caracteres: + - ( )")
        return v.strip()

    @field_validator("address", mode="before")
    @classmethod
    def validate_address(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("La dirección no puede contener solo espacios")
        return v.strip()


class PersonRead(PersonBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    active: bool
    created_at: datetime
    updated_at: datetime
