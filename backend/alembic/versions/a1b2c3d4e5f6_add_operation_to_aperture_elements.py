# -*- Python Version: 3.11 -*-
"""Add operation column to aperture_elements

Revision ID: a1b2c3d4e5f6
Revises: 95dd2b789bb4
Create Date: 2026-01-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "95dd2b789bb4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add operation column to aperture_elements table."""
    op.add_column("aperture_elements", sa.Column("operation", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove operation column from aperture_elements table."""
    op.drop_column("aperture_elements", "operation")
