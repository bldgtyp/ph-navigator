"""seed PHN-Default-Frame and PHN-Default-Glazing catalog rows

The Aperture Builder requires two named catalog rows
(``PHN-Default-Frame``, ``PHN-Default-Glazing``) to exist so that
``+ Add aperture type`` can bookshelf-copy them into new elements.
Without these rows the dispatcher raises ``aperture_default_refs_missing``
and the page surfaces a 503.

Insert is idempotent — a NOT EXISTS guard keyed on ``name`` + active
(``deleted_at IS NULL``) row ensures re-running the migration on a DB
that already has the row is a no-op. IDs follow the catalog ``rec`` +
14-char shape; deterministic literals so the rows stay referenceable
across environments.

Revision ID: 20260605_0018
Revises: 20260604_0017
Create Date: 2026-06-05 22:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260605_0018"
down_revision: str | None = "20260604_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DEFAULT_FRAME_ID = "recPHNDefFrame001"
_DEFAULT_FRAME_NAME = "PHN-Default-Frame"
_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"
_DEFAULT_GLAZING_NAME = "PHN-Default-Glazing"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO catalog_frame_types (
                id, name,
                width_mm, u_value_w_m2k, psi_g_w_mk,
                color, source
            )
            SELECT
                :id, :name,
                50.0, 1.5, 0.04,
                '#888888', 'PH-Navigator built-in default'
            WHERE NOT EXISTS (
                SELECT 1 FROM catalog_frame_types
                WHERE name = :name AND deleted_at IS NULL
            )
            """
        ).bindparams(id=_DEFAULT_FRAME_ID, name=_DEFAULT_FRAME_NAME)
    )
    op.execute(
        sa.text(
            """
            INSERT INTO catalog_glazing_types (
                id, name,
                u_value_w_m2k, g_value,
                color, source
            )
            SELECT
                :id, :name,
                1.0, 0.5,
                '#a8c8ff', 'PH-Navigator built-in default'
            WHERE NOT EXISTS (
                SELECT 1 FROM catalog_glazing_types
                WHERE name = :name AND deleted_at IS NULL
            )
            """
        ).bindparams(id=_DEFAULT_GLAZING_ID, name=_DEFAULT_GLAZING_NAME)
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM catalog_frame_types WHERE name = :name").bindparams(name=_DEFAULT_FRAME_NAME))
    op.execute(sa.text("DELETE FROM catalog_glazing_types WHERE name = :name").bindparams(name=_DEFAULT_GLAZING_NAME))
