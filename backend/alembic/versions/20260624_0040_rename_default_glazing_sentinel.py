"""rename the default-glazing sentinel PHN-Default-Glazing -> PHN-Default-Glass

The built-in default glazing row (id ``recPHNDefGlazng01``, seeded by
``20260605_0018``) is renamed so it reads in parallel with ``PHN-Default-Frame``
(window-glass-catalog-enums D-6, Ed 2026-06-24). The default glazing resolves by
**id**, not name, so this is a display-label-only change; the glazing
``recompute_names`` (Phase 3) skips the sentinel by id, leaving this label
intact. Resolve by id here too, so a stale/renamed label can't dodge the update.

Revision ID: 20260624_0040
Revises: 20260623_0039
Create Date: 2026-06-24 16:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260624_0040"
down_revision: str | None = "20260623_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"
_OLD_NAME = "PHN-Default-Glazing"
_NEW_NAME = "PHN-Default-Glass"


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE catalog_glazing_types SET name = :name WHERE id = :id").bindparams(
            name=_NEW_NAME, id=_DEFAULT_GLAZING_ID
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE catalog_glazing_types SET name = :name WHERE id = :id").bindparams(
            name=_OLD_NAME, id=_DEFAULT_GLAZING_ID
        )
    )
