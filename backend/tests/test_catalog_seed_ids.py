"""Guards for deterministic identities in the canonical catalog seeds."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from scripts._catalog_seed_ids import (
    CATALOG_SEED_PATHS,
    catalog_seed_record_id,
    validate_catalog_seed_ids,
)

_CATALOG_ID_RE = re.compile(r"^rec[A-Za-z0-9]{14}$")
_SENTINEL_NAMES = {"PHN-Default-Frame", "PHN-Default-Glass"}


@pytest.mark.parametrize("seed_path", CATALOG_SEED_PATHS, ids=lambda path: path.stem)
def test_catalog_seed_ids_are_derived_and_unique(seed_path: Path) -> None:
    document = json.loads(seed_path.read_text(encoding="utf-8"))
    validate_catalog_seed_ids(document)

    kind = document["kind"]
    rows = document["rows"]
    names = [row["name"] for row in rows]
    record_ids = [row["id"] for row in rows]

    assert all(name.isascii() for name in names)
    assert _SENTINEL_NAMES.isdisjoint(names)
    assert len(names) == len(set(names))
    assert len(record_ids) == len(set(record_ids))
    assert all(_CATALOG_ID_RE.fullmatch(record_id) for record_id in record_ids)
    assert record_ids == [catalog_seed_record_id(kind, name) for name in names]
    assert all(next(iter(row)) == "id" for row in rows)
