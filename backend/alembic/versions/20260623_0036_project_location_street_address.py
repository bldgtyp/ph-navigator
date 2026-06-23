"""project location street address

Revision ID: 20260623_0036
Revises: 20260623_0035
Create Date: 2026-06-23 08:05:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260623_0036"
down_revision: str | None = "20260623_0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("project_location", "site_address", new_column_name="street_address")
    op.add_column("project_location", sa.Column("postal_code", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE project_location
        SET postal_code = substring(street_address FROM ',\\s*([0-9]{5}(?:-[0-9]{4})?)\\s*$')
        WHERE street_address IS NOT NULL
          AND postal_code IS NULL
          AND street_address ~ ',\\s*[0-9]{5}(?:-[0-9]{4})?\\s*$'
        """
    )
    op.execute(
        """
        UPDATE project_location
        SET street_address = regexp_replace(
            street_address,
            ',\\s*' || city || '\\s*,\\s*' || state ||
                '(?:\\s*,?\\s*[0-9]{5}(?:-[0-9]{4})?)?\\s*$',
            '',
            'i'
        )
        WHERE street_address IS NOT NULL
          AND city IS NOT NULL
          AND state IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE project_location
        SET street_address = concat_ws(
            ', ',
            street_address,
            NULLIF(concat_ws(' ', NULLIF(concat_ws(', ', city, state), ''), postal_code), '')
        )
        WHERE street_address IS NOT NULL
        """
    )
    op.drop_column("project_location", "postal_code")
    op.alter_column("project_location", "street_address", new_column_name="site_address")
