"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vehicle_assignments",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("user_id", "vehicle_id"),
    )
    op.create_index("ix_vehicle_assignments_user_id", "vehicle_assignments", ["user_id"])
    op.create_index("ix_vehicle_assignments_vehicle_id", "vehicle_assignments", ["vehicle_id"])

    op.create_table(
        "assignment_audits",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column(
            "action",
            sa.Enum("CREACION", "MODIFICACION", "ELIMINACION", name="actiontype"),
            nullable=False,
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("previous_data", sa.JSON(), nullable=True),
        sa.Column("new_data", sa.JSON(), nullable=True),
    )
    op.create_index("ix_assignment_audits_user_id", "assignment_audits", ["user_id"])
    op.create_index("ix_assignment_audits_vehicle_id", "assignment_audits", ["vehicle_id"])


def downgrade() -> None:
    op.drop_index("ix_assignment_audits_vehicle_id", table_name="assignment_audits")
    op.drop_index("ix_assignment_audits_user_id", table_name="assignment_audits")
    op.drop_table("assignment_audits")
    op.execute("DROP TYPE IF EXISTS actiontype")
    op.drop_index("ix_vehicle_assignments_vehicle_id", table_name="vehicle_assignments")
    op.drop_index("ix_vehicle_assignments_user_id", table_name="vehicle_assignments")
    op.drop_table("vehicle_assignments")
