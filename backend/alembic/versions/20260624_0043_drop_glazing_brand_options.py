"""drop the glazing-type ``brand`` single-select options

Correction to window-glass-catalog-enums: ``brand`` was mistakenly promoted to
a single-select alongside ``manufacturer``. It reverts to free text — its values
are near-unique glass make-up strings (one per row), so a curated option list
gave no grouping benefit. ``brand`` stays a column and a composed-name part
(``manufacturer | brand | suffix``); only its presence in the
``catalog_field_options`` store is removed.

The seed migration ``20260624_0041`` is constant-driven
(``GLAZING_TYPE_OPTION_SEEDS``), so a fresh database never creates ``brand``
options once that constant drops the key. This migration removes the rows that
``0041`` already inserted on databases migrated before the correction — a no-op
on a fresh install.

Revision ID: 20260624_0043
Revises: 20260624_0042
Create Date: 2026-06-24 21:10:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260624_0043"
down_revision: str | None = "20260624_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("DELETE FROM catalog_field_options WHERE catalog_table = 'glazing_types' AND field_key = 'brand'")
    )


def downgrade() -> None:
    # No-op: the dropped ``brand`` options were a mistake (the value list lives
    # only in git history now), so there is nothing meaningful to restore.
    pass
