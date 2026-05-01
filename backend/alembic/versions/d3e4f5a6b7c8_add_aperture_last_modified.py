# -*- Python Version: 3.11 -*-
"""Add ``last_modified`` to all six aperture-domain tables.

Each row carries its own DB-clock ``last_modified`` stamp. The
aperture serializer aggregates the max() across the parent aperture,
its elements, those elements' glazing/frame children, and the
referenced glazing-type / frame-type catalog rows to expose a single
per-aperture ``last_modified`` value on the API. Consumers (currently
the HB Room Builder Rhino plugin) use that aggregate as a coarse
"has this type been touched?" signal.

See ``docs/plans/260501/aperture-last-modified-timestamp.md`` (§§5.2,
6.1) for the full design and rationale, especially for why this is
done as per-table columns rather than a single column on ``apertures``.

Existing rows in production receive ``func.now()`` at migration apply
time via ``server_default``, so no manual backfill is required.

Revision ID: d3e4f5a6b7c8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables that participate in the "type definition" aggregation walk.
# Order is upgrade-add / downgrade-remove order; on upgrade we add to
# all six, on downgrade we remove from all six. No FK dependencies
# between these columns, so order is cosmetic.
_TABLES: tuple[str, ...] = (
    "apertures",
    "aperture_elements",
    "aperture_element_glazing",
    "aperture_element_frame",
    "aperture_glazing_types",
    "aperture_frame_types",
)


def upgrade() -> None:
    """Upgrade schema — add ``last_modified`` to every aperture-domain table."""
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column(
                "last_modified",
                sa.DateTime(timezone=True),
                # NOT NULL with server_default ensures every existing
                # row receives the apply-time clock value, so no
                # backfill DML is required and the SQLAlchemy model's
                # nullable=False stays consistent on first deploy.
                nullable=False,
                server_default=sa.func.now(),
            ),
        )


def downgrade() -> None:
    """Downgrade schema — drop the columns added in upgrade()."""
    for table in _TABLES:
        op.drop_column(table, "last_modified")
