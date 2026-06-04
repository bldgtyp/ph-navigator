"""Schema-version upgrade chain for frame-types import files.

Mirrors `glazing_types/import_export/upgrade.py`. v0→v1 renames
`source_provenance` → `source` and `notes` → `comments`, matching the
destructive reshape in Alembic 20260604_0017. v0 files predate the seven
categorization columns (`use`, `operation`, `location`, `mull_type`,
`prefix`, `suffix`, `material`); those are absent rather than renamed,
so the upgrader just leaves them missing for `coerce_row` to default.
"""

from __future__ import annotations

from collections.abc import Callable

from features.catalogs.frame_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
)


def _upgrade_v0_to_v1(row: dict[str, object]) -> dict[str, object]:
    upgraded = dict(row)
    if "source_provenance" in upgraded and "source" not in upgraded:
        upgraded["source"] = upgraded.pop("source_provenance")
    if "notes" in upgraded and "comments" not in upgraded:
        upgraded["comments"] = upgraded.pop("notes")
    return upgraded


upgrade_steps: dict[int, Callable[[dict[str, object]], dict[str, object]]] = {
    0: _upgrade_v0_to_v1,
}


class SchemaVersionTooNewError(ValueError):
    """Raised when a file's `schema_version` exceeds the running app."""


def upgrade_row(row: dict[str, object], from_version: int) -> dict[str, object]:
    if from_version > CURRENT_SCHEMA_VERSION:
        raise SchemaVersionTooNewError(
            f"file schema_version={from_version} is newer than this app "
            f"(CURRENT_SCHEMA_VERSION={CURRENT_SCHEMA_VERSION})"
        )
    current = row
    version = from_version
    while version < CURRENT_SCHEMA_VERSION:
        step = upgrade_steps.get(version)
        if step is None:
            raise RuntimeError(
                f"missing upgrade step for schema version {version}; "
                f"upgrade_steps must cover every version below CURRENT"
            )
        current = step(current)
        version += 1
    return current
