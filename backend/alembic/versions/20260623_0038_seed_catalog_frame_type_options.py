"""seed catalog_field_options with the canonical frame-type vocabularies

Materialises the frozen Phase 0 option sets
(``features.catalogs._option_seeds.FRAME_TYPE_OPTION_SEEDS``) as the initial
dropdown lists for the six frame-type single-select fields. Idempotent via
``ON CONFLICT DO NOTHING`` on the case-insensitive label index, so re-running
upgrades never duplicate an option.

``_option_seeds`` is a pure-constants module (it imports only ``typing``), so
importing it here adds no settings/DB side-effects at alembic load time.

Revision ID: 20260623_0038
Revises: 20260623_0037
Create Date: 2026-06-23 19:05:00.000000
"""

from __future__ import annotations

import secrets
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from features.catalogs._option_seeds import FRAME_TYPE_OPTION_SEEDS

revision: str = "20260623_0038"
down_revision: str | None = "20260623_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CATALOG_TABLE = "frame_types"

# Mirror of features.project_document.options.OPTION_COLOR_PALETTE — inlined so
# the migration stays import-light (it must not pull in the document layer).
_COLORS = ("#3b82f6", "#10b981", "#a16207", "#7c3aed", "#0f766e", "#be123c")

_INSERT = sa.text(
    """
    INSERT INTO catalog_field_options (catalog_table, field_key, option_id, label, color, "order")
    VALUES (:catalog_table, :field_key, :option_id, :label, :color, :order)
    ON CONFLICT (catalog_table, field_key, lower(btrim(label))) DO NOTHING
    """
)


def upgrade() -> None:
    conn = op.get_bind()
    for field_key, labels in FRAME_TYPE_OPTION_SEEDS.items():
        for order, label in enumerate(labels):
            conn.execute(
                _INSERT,
                {
                    "catalog_table": _CATALOG_TABLE,
                    "field_key": field_key,
                    "option_id": f"opt_{secrets.token_hex(8)}",
                    "label": label,
                    "color": _COLORS[order % len(_COLORS)],
                    "order": float(order),
                },
            )


def downgrade() -> None:
    op.get_bind().execute(
        sa.text("DELETE FROM catalog_field_options WHERE catalog_table = :t"),
        {"t": _CATALOG_TABLE},
    )
