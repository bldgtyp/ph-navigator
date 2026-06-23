"""merge climate epw + ashrae sources into one weather kind

Revision ID: 20260622_0034
Revises: 20260622_0033
Create Date: 2026-06-22 21:00:00.000000

The Climate tab now has a single "Weather File" source: the EPW + STAT + DDY
bundle. The old ``epw`` source already carried the STAT design conditions, so
the separate ``ashrae`` source was pure duplication. Rename ``epw`` → ``weather``,
drop the redundant ``ashrae`` rows, and swap the ``kind`` CHECK constraint to the
merged set.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260622_0034"
down_revision: str | None = "20260622_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSTRAINT = "ck_project_climate_source_kind"
_TABLE = "project_climate_source"


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.execute(f"UPDATE {_TABLE} SET kind = 'weather' WHERE kind = 'epw'")
    op.execute(f"DELETE FROM {_TABLE} WHERE kind = 'ashrae'")
    op.create_check_constraint(_CONSTRAINT, _TABLE, "kind IN ('phius', 'phi', 'weather', 'custom')")


def downgrade() -> None:
    # The dropped ``ashrae`` rows are not recoverable; the design conditions they
    # held also live on the ``weather`` (formerly ``epw``) source's data payload.
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.execute(f"UPDATE {_TABLE} SET kind = 'epw' WHERE kind = 'weather'")
    op.create_check_constraint(_CONSTRAINT, _TABLE, "kind IN ('phius', 'phi', 'ashrae', 'epw', 'custom')")
