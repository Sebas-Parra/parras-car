"""seed roles and admin user

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-15 00:00:01.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLES = ["estudiante", "profesor", "administrador", "visitante"]
ADMIN_CEDULA = "0000000000"

ROLE_IDS = {name: uuid.uuid4() for name in ROLES}
ADMIN_PERSON_ID = uuid.uuid4()


def upgrade() -> None:
    now = datetime.now(timezone.utc)

    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
    )
    op.bulk_insert(
        roles_table,
        [{"id": ROLE_IDS[name], "name": name, "description": name.capitalize()} for name in ROLES],
    )

    persons_table = sa.table(
        "persons",
        sa.column("id", sa.Uuid()),
        sa.column("cedula", sa.String),
        sa.column("first_name", sa.String),
        sa.column("middle_name", sa.String),
        sa.column("last_name", sa.String),
        sa.column("email", sa.String),
        sa.column("phone", sa.String),
        sa.column("address", sa.String),
        sa.column("nationality", sa.String),
        sa.column("active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    op.bulk_insert(
        persons_table,
        [
            {
                "id": ADMIN_PERSON_ID,
                "cedula": ADMIN_CEDULA,
                "first_name": "Admin",
                "middle_name": None,
                "last_name": "System",
                "email": "admin@parras-car.com",
                "phone": None,
                "address": None,
                "nationality": None,
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    password_hash = bcrypt.hashpw(b"Admin123!", bcrypt.gensalt()).decode("utf-8")

    users_table = sa.table(
        "users",
        sa.column("id_person", sa.Uuid()),
        sa.column("username", sa.String),
        sa.column("password_hash", sa.String),
        sa.column("active", sa.Boolean),
        sa.column("last_login", sa.DateTime),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    op.bulk_insert(
        users_table,
        [
            {
                "id_person": ADMIN_PERSON_ID,
                "username": "admin",
                "password_hash": password_hash,
                "active": True,
                "last_login": None,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    user_roles_table = sa.table(
        "user_roles",
        sa.column("id_user", sa.Uuid()),
        sa.column("id_role", sa.Uuid()),
        sa.column("assigned_at", sa.DateTime),
    )
    op.bulk_insert(
        user_roles_table,
        [{"id_user": ADMIN_PERSON_ID, "id_role": ROLE_IDS["administrador"], "assigned_at": now}],
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM user_roles WHERE id_user = :id"),
        {"id": str(ADMIN_PERSON_ID)},
    )
    connection.execute(
        sa.text("DELETE FROM users WHERE id_person = :id"),
        {"id": str(ADMIN_PERSON_ID)},
    )
    connection.execute(sa.text("DELETE FROM persons WHERE cedula = :cedula"), {"cedula": ADMIN_CEDULA})
    connection.execute(sa.text("DELETE FROM roles WHERE name IN :names").bindparams(sa.bindparam("names", expanding=True)), {"names": ROLES})
