"""backfill catalog_glazing_types.name from the derived parts

``name`` is now a server-derived label (D-3): the non-empty parts joined by
``" | "`` in a fixed order (manufacturer, brand, suffix). This recomputes the
stored name for every existing glazing row so it matches the composer, using
``concat_ws`` (skips NULLs) + ``NULLIF(btrim(x), '')`` (folds blank → NULL),
which reproduces ``compose_glazing_name`` exactly.

The built-in default sentinel (``recPHNDefGlazng01``) is **skipped**: its parts
are all null, so the composed name would be ``""``, and ``GlazingRef.name``
requires ``min_length=1``. It is resolved by id, not name, so it keeps its
``PHN-Default-Glass`` label.

In practice this is a near no-op: the catalog seeds through the import script
(run after migrations), so at migration time the only glazing row is the
sentinel (skipped). It exists to correctly recompute any rows that *do* predate
it.

Revision ID: 20260624_0042
Revises: 20260624_0041
Create Date: 2026-06-24 17:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260624_0042"
down_revision: str | None = "20260624_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"


def upgrade() -> None:
    # This SQL must stay in sync with `glazing_types.service.compose_glazing_name`
    # and `glazing_types.repository._COMPOSE_NAME_SQL` — migrations are frozen and
    # cannot import app code, so the formula is inlined here deliberately.
    op.execute(
        sa.text(
            """
            UPDATE catalog_glazing_types
            SET name = left(
                concat_ws(
                    ' | ',
                    NULLIF(btrim(manufacturer), ''),
                    NULLIF(btrim(brand), ''),
                    NULLIF(btrim(suffix), '')
                ),
                200
            )
            WHERE id <> :default_glazing_id
            """
        ).bindparams(default_glazing_id=_DEFAULT_GLAZING_ID)
    )


def downgrade() -> None:
    # No-op: on clean data the stored name already equals the composed value.
    pass
