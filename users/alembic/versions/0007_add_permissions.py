"""add permissions and role_permissions

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-26 00:00:00.000000

Introduce a granular permission catalog. New roles default to only the
permissions flagged as public (is_public=True) unless explicitly selected
in the role-creation UI.
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSIONS = [
    {
        "name": "publico",
        "description": "Acceso público de solo lectura (catálogo de espacios, disponibilidad en vivo)",
        "is_public": True,
    },
    {
        "name": "gestionar_usuarios",
        "description": "Activar/desactivar usuarios y asignarles roles",
        "is_public": False,
    },
    {
        "name": "gestionar_roles",
        "description": "Crear, editar y eliminar roles del sistema",
        "is_public": False,
    },
    {
        "name": "gestionar_vehiculos",
        "description": "Editar, activar y desactivar vehículos de cualquier usuario",
        "is_public": False,
    },
    {
        "name": "gestionar_zonas",
        "description": "Crear y editar zonas y espacios de estacionamiento",
        "is_public": False,
    },
    {
        "name": "eliminar_zonas",
        "description": "Eliminación física de zonas y espacios",
        "is_public": False,
    },
    {
        "name": "gestionar_tickets",
        "description": "Emitir, cobrar y anular tickets de estacionamiento",
        "is_public": False,
    },
    {
        "name": "gestionar_asignaciones",
        "description": "Asignar, transferir y quitar vehículos de la flota de otros usuarios",
        "is_public": False,
    },
    {
        "name": "ver_auditoria",
        "description": "Consultar los registros de auditoría del sistema",
        "is_public": False,
    },
]

PERMISSION_IDS = {p["name"]: uuid.uuid4() for p in PERMISSIONS}


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_permissions_name", "permissions", ["name"], unique=True)

    op.create_table(
        "role_permissions",
        sa.Column("id_role", sa.Uuid(), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("id_permission", sa.Uuid(), sa.ForeignKey("permissions.id"), primary_key=True),
        sa.Column("assigned_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("is_public", sa.Boolean),
    )
    op.bulk_insert(
        permissions_table,
        [
            {
                "id": PERMISSION_IDS[p["name"]],
                "name": p["name"],
                "description": p["description"],
                "is_public": p["is_public"],
            }
            for p in PERMISSIONS
        ],
    )


def downgrade() -> None:
    op.drop_table("role_permissions")
    op.drop_index("ix_permissions_name", table_name="permissions")
    op.drop_table("permissions")
