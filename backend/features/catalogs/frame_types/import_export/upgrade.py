"""Schema-version upgrade chain for frame-types import files.

v0→v1 renames `source_provenance` → `source` and `notes` → `comments`, matching
the destructive reshape in Alembic 20260604_0017. v0 files predate the seven
categorization columns; those are absent rather than renamed.

v1→v2 (window-frames-catalog-enums) folds the legacy/typo values the AirTable
export carried into the canonical single-select vocabularies — using the frozen
Phase 0 fold map (`_option_seeds`) — so a dirty v1 file lands clean. A step may
also **drop** a row entirely (the `Default` artifact), signalled by returning
`None`.
"""

from __future__ import annotations

from collections.abc import Callable

from features.catalogs._option_seeds import (
    FRAME_TYPE_DROP_MANUFACTURERS,
    FRAME_TYPE_SWAPPED_MANUFACTURER_BRAND,
    FRAME_TYPE_VALUE_FOLDS,
)
from features.catalogs.frame_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
)

# An upgrade step maps a row to its upgraded form, or to ``None`` to drop it.
UpgradeStep = Callable[[dict[str, object]], dict[str, object] | None]


def _upgrade_v0_to_v1(row: dict[str, object]) -> dict[str, object]:
    upgraded = dict(row)
    if "source_provenance" in upgraded and "source" not in upgraded:
        upgraded["source"] = upgraded.pop("source_provenance")
    if "notes" in upgraded and "comments" not in upgraded:
        upgraded["comments"] = upgraded.pop("notes")
    return upgraded


def _upgrade_v1_to_v2(row: dict[str, object]) -> dict[str, object] | None:
    """Fold legacy/typo values into the canonical vocabularies (Phase 0)."""
    upgraded = dict(row)

    # Drop the `Default` artifact row entirely — the real default is the
    # recPHNDefFrame001 sentinel (resolved by id, Phase 3).
    manufacturer = upgraded.get("manufacturer")
    if isinstance(manufacturer, str) and manufacturer.strip() in FRAME_TYPE_DROP_MANUFACTURERS:
        return None

    # Fix the transposed Mercury/CURRIES rows (manufacturer/brand swapped).
    dirty_manufacturer, dirty_brand = FRAME_TYPE_SWAPPED_MANUFACTURER_BRAND["dirty"]
    canonical_manufacturer, canonical_brand = FRAME_TYPE_SWAPPED_MANUFACTURER_BRAND["canonical"]
    if upgraded.get("manufacturer") == dirty_manufacturer and upgraded.get("brand") == dirty_brand:
        upgraded["manufacturer"] = canonical_manufacturer
        upgraded["brand"] = canonical_brand

    # Value-level folds, keyed field → lower(trimmed) → canonical (e.g.
    # OP-TO-FIX → OP-to-FX; source `manufacturer` → `Manufacturer`).
    for field, fold_map in FRAME_TYPE_VALUE_FOLDS.items():
        value = upgraded.get(field)
        if isinstance(value, str):
            canonical = fold_map.get(value.strip().lower())
            if canonical is not None:
                upgraded[field] = canonical

    return upgraded


upgrade_steps: dict[int, UpgradeStep] = {
    0: _upgrade_v0_to_v1,
    1: _upgrade_v1_to_v2,
}


class SchemaVersionTooNewError(ValueError):
    """Raised when a file's `schema_version` exceeds the running app."""


def upgrade_row(row: dict[str, object], from_version: int) -> dict[str, object] | None:
    """Upgrade a row to ``CURRENT_SCHEMA_VERSION``. Returns ``None`` if a step
    drops the row (e.g. the `Default` artifact)."""
    if from_version > CURRENT_SCHEMA_VERSION:
        raise SchemaVersionTooNewError(
            f"file schema_version={from_version} is newer than this app "
            f"(CURRENT_SCHEMA_VERSION={CURRENT_SCHEMA_VERSION})"
        )
    current: dict[str, object] | None = row
    version = from_version
    while version < CURRENT_SCHEMA_VERSION:
        step = upgrade_steps.get(version)
        if step is None:
            raise RuntimeError(
                f"missing upgrade step for schema version {version}; "
                f"upgrade_steps must cover every version below CURRENT"
            )
        assert current is not None
        current = step(current)
        if current is None:
            return None
        version += 1
    return current
