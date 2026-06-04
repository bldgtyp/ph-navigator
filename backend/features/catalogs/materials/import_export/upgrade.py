"""Schema-version upgrade chain for catalog import files.

A row arriving under an older `schema_version` is piped through each
`upgrade_steps[v]` in order until it reaches `CURRENT_SCHEMA_VERSION`.
Steps are pure dict→dict functions; they rename, drop, or default
fields but never raise on recoverable input.

v1 is the current shape, so `upgrade_steps` only carries the
fabricated v0→v1 step today. The step is real (it implements the
PRD's example: `source_provenance` → `source`, `notes` → `comments`)
so a unit test can exercise the chain and protect future bumps from
silently breaking.
"""

from __future__ import annotations

from collections.abc import Callable

from features.catalogs.materials.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
)


def _upgrade_v0_to_v1(row: dict[str, object]) -> dict[str, object]:
    """Rename legacy v0 keys to v1."""
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
    """Walk the row from `from_version` up to `CURRENT_SCHEMA_VERSION`."""
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
