from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PersonBase(BaseModel):
    cedula: str = Field(pattern=r"^\d{10}$")
    first_name: str
    middle_name: str | None = None
    last_name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    nationality: str | None = None


class PersonUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
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
