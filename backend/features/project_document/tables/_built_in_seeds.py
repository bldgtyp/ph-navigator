"""Shared helper for declaring built-in `TableFieldDef` seeds.

Each table's `BUILT_IN_FIELD_DEFS` tuple is the feature-author's
declaration of the persisted FieldDef registry on a new project. The
helper here keeps the seed-construction call site terse and pins a
stable `created_at` so re-seeding the same project doesn't drift the
fingerprint (built-in identity is the `field_key`, not the timestamp).
"""

from __future__ import annotations

from datetime import UTC, datetime

from features.project_document.custom_fields import (
    CustomFieldType,
    CustomValue,
    TableFieldDef,
)

# Stable seed timestamp: re-seeding the same built-in entry yields a
# byte-identical FieldDef, so the schema fingerprint doesn't drift.
BUILT_IN_SEEDED_AT = datetime(2026, 5, 26, 0, 0, 0, tzinfo=UTC)


def built_in_field_def(
    *,
    field_key: str,
    display_name: str,
    field_type: CustomFieldType,
    config: dict[str, object] | None = None,
    description: str | None = None,
    default: CustomValue = None,
) -> TableFieldDef:
    """Return a `TableFieldDef` with `origin="built_in"` and a stable
    seed timestamp. Used by every per-table `*_BUILT_IN_FIELD_DEFS`
    tuple."""
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=field_type,
        config=config or {},
        description=description,
        default=default,
        origin="built_in",
        created_at=BUILT_IN_SEEDED_AT,
        created_by=None,
    )
