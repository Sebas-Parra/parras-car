import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

_NAME_REGEX = re.compile(r"^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s_]+$")


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre del rol no puede contener solo espacios")
        if not _NAME_REGEX.match(v.strip()):
            raise ValueError("El nombre del rol solo puede contener letras, espacios y guion bajo")
        return v.strip()

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("La descripción no puede contener solo espacios")
        return v.strip()


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=50)
    description: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("El nombre del rol no puede contener solo espacios")
        if not _NAME_REGEX.match(v.strip()):
            raise ValueError("El nombre del rol solo puede contener letras, espacios y guion bajo")
        return v.strip()

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("La descripción no puede contener solo espacios")
        return v.strip()


class RoleAssign(BaseModel):
    role_id: UUID
