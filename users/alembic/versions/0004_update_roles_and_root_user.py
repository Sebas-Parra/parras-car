"""update roles and create root user

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-29 00:00:00.000000

Replaces the old academic roles (estudiante, profesor, administrador, visitante)
with the parking-system roles (cliente, recaudador, admin, root).
Also updates the seeded 'admin' user to the new 'admin' role and creates a 'root' superuser.
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_ROLES = ["estudiante", "profesor", "administrador", "visitante"]

NEW_ROLES = [
    {"name": "cliente",     "description": "Usuario registrado con acceso básico al sistema"},
    {"name": "recaudador",  "description": "Empleado autorizado para emitir y cobrar tickets de estacionamiento"},
    {"name": "admin",       "description": "Administrador: gestiona zonas, vehículos, usuarios y asignaciones"},
    {"name": "root",        "description": "Super administrador con acceso total, incluyendo eliminaciones físicas"},
]

NEW_ROLE_IDS = {r["name"]: uuid.uuid4() for r in NEW_ROLES}

ROOT_PERSON_ID = uuid.uuid4()
ROOT_CEDULA = "0000000001"


def upgrade() -> None:
    now = datetime.now(timezone.utc)
    connection = op.get_bind()

    # ── 1. Remove old role assignments and old roles ──────────────────────────
    connection.execute(
        sa.text(
            "DELETE FROM user_roles WHERE id_role IN "
            "(SELECT id FROM roles WHERE name = ANY(:names))"
        ),
        {"names": OLD_ROLES},
    )
    connection.execute(
        sa.text("DELETE FROM roles WHERE name = ANY(:names)"),
        {"names": OLD_ROLES},
    )

    # ── 2. Insert new roles (idempotent) ─────────────────────────────────────
    for r in NEW_ROLES:
        connection.execute(
            sa.text(
                "INSERT INTO roles (id, name, description) VALUES (:id, :name, :desc) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {"id": NEW_ROLE_IDS[r["name"]], "name": r["name"], "desc": r["description"]},
        )

    # Fetch real IDs in case rows already existed with different UUIDs
    role_ids = {
        row[0]: row[1]
        for row in connection.execute(
            sa.text("SELECT name, id FROM roles WHERE name = ANY(:names)"),
            {"names": [r["name"] for r in NEW_ROLES]},
        ).fetchall()
    }

    # ── 3. Re-assign 'admin' role to the seeded admin user ───────────────────
    connection.execute(
        sa.text(
            "INSERT INTO user_roles (id_user, id_role, assigned_at) "
            "SELECT u.id_person, :role_id, :now "
            "FROM users u WHERE u.username = 'admin' "
            "ON CONFLICT DO NOTHING"
        ),
        {"role_id": role_ids["admin"], "now": now},
    )

    # ── 4. Create root person (idempotent) ────────────────────────────────────
    connection.execute(
        sa.text(
            "INSERT INTO persons (id, cedula, first_name, middle_name, last_name, email, "
            "phone, address, nationality, active, created_at, updated_at) "
            "VALUES (:id, :cedula, :first_name, NULL, :last_name, :email, "
            "NULL, NULL, NULL, TRUE, :now, :now) "
            "ON CONFLICT (cedula) DO NOTHING"
        ),
        {
            "id": ROOT_PERSON_ID,
            "cedula": ROOT_CEDULA,
            "first_name": "Root",
            "last_name": "System",
            "email": "root@parras-car.com",
            "now": now,
        },
    )

    # ── 5. Create root user (idempotent) ──────────────────────────────────────
    root_hash = bcrypt.hashpw(b"Root123!", bcrypt.gensalt()).decode("utf-8")
    connection.execute(
        sa.text(
            "INSERT INTO users (id_person, username, password_hash, active, last_login, created_at, updated_at) "
            "SELECT p.id, 'root', :hash, TRUE, NULL, :now, :now "
            "FROM persons p WHERE p.cedula = :cedula "
            "ON CONFLICT DO NOTHING"
        ),
        {"hash": root_hash, "cedula": ROOT_CEDULA, "now": now},
    )

    # ── 6. Assign 'root' role to root user (idempotent) ───────────────────────
    connection.execute(
        sa.text(
            "INSERT INTO user_roles (id_user, id_role, assigned_at) "
            "SELECT p.id, :role_id, :now FROM persons p WHERE p.cedula = :cedula "
            "ON CONFLICT DO NOTHING"
        ),
        {"role_id": role_ids["root"], "cedula": ROOT_CEDULA, "now": now},
    )


def downgrade() -> None:
    connection = op.get_bind()

    # Remove root user
    connection.execute(sa.text("DELETE FROM user_roles WHERE id_user = :id"), {"id": str(ROOT_PERSON_ID)})
    connection.execute(sa.text("DELETE FROM users WHERE id_person = :id"), {"id": str(ROOT_PERSON_ID)})
    connection.execute(sa.text("DELETE FROM persons WHERE cedula = :cedula"), {"cedula": ROOT_CEDULA})

    # Remove new roles (user_roles for admin will also be lost)
    new_names = [r["name"] for r in NEW_ROLES]
    connection.execute(
        sa.text("DELETE FROM user_roles WHERE id_role IN (SELECT id FROM roles WHERE name = ANY(:names))"),
        {"names": new_names},
    )
    connection.execute(sa.text("DELETE FROM roles WHERE name = ANY(:names)"), {"names": new_names})

    # Restore old roles
    old_role_ids = {name: uuid.uuid4() for name in OLD_ROLES}
    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
    )
    op.bulk_insert(
        roles_table,
        [{"id": old_role_ids[n], "name": n, "description": n.capitalize()} for n in OLD_ROLES],
    )
