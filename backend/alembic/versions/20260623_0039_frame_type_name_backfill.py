"""backfill catalog_frame_types.name from the derived parts

``name`` is now a server-derived label (D-3): the non-empty parts joined by
``" | "`` in a fixed order (manufacturer, prefix, brand, use, operation,
location, mull_type, suffix), ``material`` excluded. This recomputes the stored
name for every existing frame row so it matches the composer, using
``concat_ws`` (skips NULLs) + ``NULLIF(btrim(x), '')`` (folds blank → NULL),
which reproduces ``compose_frame_name`` exactly.

The built-in default sentinel (``recPHNDefFrame001``) is **skipped**: its parts
are all null, so the composed name would be ``""``, and ``FrameRef.name``
requires ``min_length=1``. It is resolved by id, not name, so it keeps its
seeded ``PHN-Default-Frame`` label.

In practice this is a near no-op: the catalog seeds through the import script
(run after migrations), so at migration time the only frame row is the sentinel
(skipped). It exists to correctly recompute any rows that *do* predate it.

Revision ID: 20260623_0039
Revises: 20260623_0038
Create Date: 2026-06-23 19:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260623_0039"
down_revision: str | None = "20260623_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFAULT_FRAME_ID = "recPHNDefFrame001"


def upgrade() -> None:
    # This SQL must stay in sync with `frame_types.service.compose_frame_name`
    # and `frame_types.repository._COMPOSE_NAME_SQL` — migrations are frozen and
    # cannot import app code, so the formula is inlined here deliberately.
    op.execute(
        sa.text(
            """
            UPDATE catalog_frame_types
            SET name = left(
                concat_ws(
                    ' | ',
                    NULLIF(btrim(manufacturer), ''),
                    NULLIF(btrim(prefix), ''),
                    NULLIF(btrim(brand), ''),
                    NULLIF(btrim("use"), ''),
                    NULLIF(btrim(operation), ''),
                    NULLIF(btrim(location), ''),
                    NULLIF(btrim(mull_type), ''),
                    NULLIF(btrim(suffix), '')
                ),
                200
            )
            WHERE id <> :default_frame_id
            """
        ).bindparams(default_frame_id=_DEFAULT_FRAME_ID)
    )


def downgrade() -> None:
    # No-op: on clean data the stored name already equals the composed value.
    pass
