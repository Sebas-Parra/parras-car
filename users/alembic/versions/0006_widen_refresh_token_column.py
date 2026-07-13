"""widen refresh_tokens.token column to fit longer tokens

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-13 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "refresh_tokens",
        "token",
        existing_type=sa.String(length=64),
        type_=sa.String(length=320),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "refresh_tokens",
        "token",
        existing_type=sa.String(length=320),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
