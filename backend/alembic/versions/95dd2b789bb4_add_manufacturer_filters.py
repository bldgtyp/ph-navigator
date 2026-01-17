"""add_manufacturer_filters

Revision ID: 95dd2b789bb4
Revises: 003cd631d956
Create Date: 2026-01-17 12:37:51.148012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95dd2b789bb4'
down_revision: Union[str, None] = '003cd631d956'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'project_manufacturer_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('manufacturer', sa.String(length=255), nullable=False),
        sa.Column('filter_type', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_project_manufacturer_filters_id'),
        'project_manufacturer_filters',
        ['id'],
        unique=False
    )
    op.create_index(
        op.f('ix_project_manufacturer_filters_project_id'),
        'project_manufacturer_filters',
        ['project_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_project_manufacturer_filters_project_id'), table_name='project_manufacturer_filters')
    op.drop_index(op.f('ix_project_manufacturer_filters_id'), table_name='project_manufacturer_filters')
    op.drop_table('project_manufacturer_filters')
