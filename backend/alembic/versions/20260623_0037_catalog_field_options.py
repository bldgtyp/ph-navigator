"""catalog_field_options — global single-select option store for catalogs

Stands up the catalog-scoped option registry the window-frames-catalog-enums
refactor needs (PLAN Phase 1). Unlike the project-document
``single_select_options`` JSON map (which is document-scoped), catalogs are
global, so their vocabularies live in this relational table keyed by
``(catalog_table, field_key)``. Built generic from the start (D-7) so
glazing-types and materials can adopt it later with no schema change.

Rows store the option **label string** (D-2): the table is a vocabulary
registry, not an id-join target, so there is intentionally no foreign key to
the catalog row tables. That also means a CASCADE truncate of
``catalog_frame_types`` does not touch these options.

Revision ID: 20260623_0037
Revises: 20260623_0036
Create Date: 2026-06-23 19:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260623_0037"
down_revision: str | None = "20260623_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "catalog_field_options",
        sa.Column("catalog_table", sa.Text(), nullable=False),
        sa.Column("field_key", sa.Text(), nullable=False),
        sa.Column("option_id", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("color", sa.Text(), nullable=False),
        sa.Column("order", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("catalog_table", "field_key", "option_id"),
    )
    # Case-insensitive label uniqueness within a field — matches the
    # `validate_option_list` semantics (duplicate labels rejected on trimmed
    # lower-case). A functional index, so it is created with raw SQL.
    op.execute(
        """
        CREATE UNIQUE INDEX ux_catalog_field_options_label
        ON catalog_field_options (catalog_table, field_key, lower(btrim(label)))
        """
    )


def downgrade() -> None:
    op.drop_table("catalog_field_options")
