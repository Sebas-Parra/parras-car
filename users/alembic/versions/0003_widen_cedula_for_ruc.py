"""widen cedula column to support RUC

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "persons",
        "cedula",
        existing_type=sa.String(length=10),
        type_=sa.String(length=13),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "persons",
        "cedula",
        existing_type=sa.String(length=13),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
