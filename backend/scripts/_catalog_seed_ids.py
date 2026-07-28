"""Derive and validate stable identities for the canonical catalog seeds.

Catalog seed ids intentionally depend on the catalog kind and row name. Renaming
a row therefore creates a new logical catalog record; other row edits retain the
existing identity.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import string
from pathlib import Path
from typing import cast

from scripts._seed_paths import FRAME_SEED_PATH, GLAZING_SEED_PATH, MATERIALS_SEED_PATH

_BASE62_ALPHABET = string.ascii_letters + string.digits
_CATALOG_ID_RE = re.compile(r"^rec[A-Za-z0-9]{14}$")
_SENTINEL_NAMES = frozenset({"PHN-Default-Frame", "PHN-Default-Glass"})
CATALOG_SEED_PATHS = (MATERIALS_SEED_PATH, FRAME_SEED_PATH, GLAZING_SEED_PATH)


def _base62(value: int) -> str:
    encoded: list[str] = []
    while value:
        value, remainder = divmod(value, len(_BASE62_ALPHABET))
        encoded.append(_BASE62_ALPHABET[remainder])
    return "".join(reversed(encoded)) or _BASE62_ALPHABET[0]


def catalog_seed_record_id(kind: str, name: str) -> str:
    """Return the reproducible catalog id owned by one kind/name pair."""
    key = f"{kind}\x1f{name}".encode()
    digest_value = int.from_bytes(hashlib.sha256(key).digest(), byteorder="big")
    return f"rec{_base62(digest_value)[:14]}"


def _catalog_rows(document: object) -> tuple[str, list[dict[str, object]]]:
    if not isinstance(document, dict):
        raise ValueError("Catalog seed must be a JSON object.")
    document_object = cast(dict[str, object], document)

    kind = document_object.get("kind")
    rows = document_object.get("rows")
    if not isinstance(kind, str) or not kind:
        raise ValueError("Catalog seed must have a non-empty string kind.")
    if not isinstance(rows, list):
        raise ValueError("Catalog seed must have a rows array.")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Every catalog seed row must be a JSON object.")

    return kind, cast(list[dict[str, object]], rows)


def validate_catalog_seed_ids(document: object) -> None:
    """Reject seed identities that could drift or collide silently."""
    kind, rows = _catalog_rows(document)
    names: set[str] = set()
    record_ids: set[str] = set()

    for index, row in enumerate(rows):
        name = row.get("name")
        record_id = row.get("id")
        if not isinstance(name, str) or not name:
            raise ValueError(f"Catalog seed row {index} must have a non-empty string name.")
        if not name.isascii():
            raise ValueError(f"Catalog seed row {index} name must be ASCII: {name!r}.")
        if name in _SENTINEL_NAMES:
            raise ValueError(f"Catalog seed must not include sentinel row {name!r}.")
        if name in names:
            raise ValueError(f"Catalog seed natural key is duplicated: {name!r}.")
        names.add(name)

        expected_id = catalog_seed_record_id(kind, name)
        if not isinstance(record_id, str) or _CATALOG_ID_RE.fullmatch(record_id) is None:
            raise ValueError(f"Catalog seed row {name!r} has an invalid id: {record_id!r}.")
        if record_id != expected_id:
            raise ValueError(f"Catalog seed row {name!r} has id {record_id!r}; expected {expected_id!r}.")
        if record_id in record_ids:
            raise ValueError(f"Catalog seed id is duplicated: {record_id!r}.")
        record_ids.add(record_id)


def add_catalog_seed_ids(document: object) -> dict[str, object]:
    """Return an export-shaped seed document with a derived id first in each row."""
    kind, rows = _catalog_rows(document)
    document_object = cast(dict[str, object], document)
    updated_rows: list[dict[str, object]] = []
    for row in rows:
        name = row.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError("Every catalog seed row must have a non-empty string name.")
        row_without_id = {key: value for key, value in row.items() if key != "id"}
        updated_rows.append({"id": catalog_seed_record_id(kind, name), **row_without_id})

    updated_document: dict[str, object] = {**document_object, "rows": updated_rows}
    validate_catalog_seed_ids(updated_document)
    return updated_document


def write_catalog_seed_ids(path: Path) -> tuple[int, bool]:
    """Rewrite one canonical seed with deterministic ids and stable formatting."""
    original = path.read_text(encoding="utf-8")
    document: object = json.loads(original)
    updated_document = add_catalog_seed_ids(document)
    rendered = f"{json.dumps(updated_document, indent=2)}\n"
    changed = rendered != original
    if changed:
        path.write_text(rendered, encoding="utf-8")
    _, rows = _catalog_rows(updated_document)
    return len(rows), changed


def main() -> None:
    """Regenerate deterministic ids in every canonical catalog seed."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    for path in CATALOG_SEED_PATHS:
        count, changed = write_catalog_seed_ids(path)
        status = "Updated" if changed else "Already current"
        print(f"{status}: {count} rows: {path}")


if __name__ == "__main__":
    main()
