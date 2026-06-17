from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

NAME_FIELD = Field(min_length=2, max_length=50)
OPTIONAL_NAME_FIELD = Field(default=None, min_length=2, max_length=50)


class PersonBase(BaseModel):
    cedula: str = Field(pattern=r"^\d{10}$")
    first_name: str = NAME_FIELD
    middle_name: str | None = OPTIONAL_NAME_FIELD
    last_name: str = NAME_FIELD
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None


class PersonUpdate(BaseModel):
    first_name: str | None = OPTIONAL_NAME_FIELD
    middle_name: str | None = OPTIONAL_NAME_FIELD
    last_name: str | None = OPTIONAL_NAME_FIELD
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None


class PersonRead(PersonBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    active: bool
    created_at: datetime
    updated_at: datetime
