"""add awning and hopper frame operation options

Revision ID: 20260627_0002
Revises: 20260624_0001
Create Date: 2026-06-27 10:10:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260627_0002"
down_revision: str | None = "20260624_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO catalog_field_options
            (catalog_table, field_key, option_id, label, color, "order")
        SELECT seed.catalog_table, seed.field_key, seed.option_id, seed.label, seed.color, seed."order"
        FROM (
            VALUES
                ('frame_types', 'operation', 'opt_a7c3e92f1b460d2a', 'Awning', '#7c3aed', 3::double precision),
                ('frame_types', 'operation', 'opt_b8d4f03a2c571e3b', 'Hopper', '#0f766e', 4::double precision)
        ) AS seed(catalog_table, field_key, option_id, label, color, "order")
        WHERE NOT EXISTS (
            SELECT 1
            FROM catalog_field_options AS existing
            WHERE existing.catalog_table = seed.catalog_table
              AND existing.field_key = seed.field_key
              AND lower(btrim(existing.label)) = lower(seed.label)
        )
        ON CONFLICT (catalog_table, field_key, option_id) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE catalog_field_options AS option
        SET
            "order" = canonical."order",
            color = canonical.color,
            updated_at = now()
        FROM (
            VALUES
                ('Inswing', '#3b82f6', 0::double precision),
                ('Outswing', '#10b981', 1::double precision),
                ('Casement', '#a16207', 2::double precision),
                ('Awning', '#7c3aed', 3::double precision),
                ('Hopper', '#0f766e', 4::double precision),
                ('Fixed', '#be123c', 5::double precision),
                ('Tilt-Turn', '#3b82f6', 6::double precision),
                ('Sliding', '#10b981', 7::double precision),
                ('Double-Hung', '#a16207', 8::double precision)
        ) AS canonical(label, color, "order")
        WHERE option.catalog_table = 'frame_types'
          AND option.field_key = 'operation'
          AND lower(btrim(option.label)) = lower(canonical.label)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM catalog_field_options
        WHERE catalog_table = 'frame_types'
          AND field_key = 'operation'
          AND label IN ('Awning', 'Hopper')
        """
    )
    op.execute(
        """
        UPDATE catalog_field_options AS option
        SET
            "order" = legacy."order",
            color = legacy.color,
            updated_at = now()
        FROM (
            VALUES
                ('Inswing', '#3b82f6', 0::double precision),
                ('Casement', '#10b981', 1::double precision),
                ('Fixed', '#a16207', 2::double precision),
                ('Sliding', '#7c3aed', 3::double precision),
                ('Outswing', '#0f766e', 4::double precision),
                ('Tilt-Turn', '#be123c', 5::double precision),
                ('Double-Hung', '#3b82f6', 6::double precision)
        ) AS legacy(label, color, "order")
        WHERE option.catalog_table = 'frame_types'
          AND option.field_key = 'operation'
          AND lower(btrim(option.label)) = lower(legacy.label)
        """
    )
