"""Guards for deterministic identities in the canonical catalog seeds."""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

import pytest

from features.catalogs.frame_types.import_export.pipeline import build_preview as build_frame_preview
from features.catalogs.glazing_types.import_export.pipeline import (
    build_preview as build_glazing_preview,
)
from features.catalogs.materials.import_export.pipeline import (
    build_preview as build_materials_preview,
)
from scripts._catalog_seed_ids import (
    CATALOG_SEED_PATHS,
    catalog_seed_record_id,
    load_catalog_seed,
    validate_catalog_seed_ids,
)
from scripts._seed_paths import FRAME_SEED_PATH, GLAZING_SEED_PATH, MATERIALS_SEED_PATH

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


class _PreviewCounts(Protocol):
    @property
    def new(self) -> int: ...

    @property
    def matched(self) -> int: ...

    @property
    def errored(self) -> int: ...


class _WriteSet(Protocol):
    @property
    def rows_to_insert(self) -> list[dict[str, object]]: ...


class _PreviewReport(Protocol):
    @property
    def counts(self) -> _PreviewCounts: ...

    @property
    def write_set(self) -> _WriteSet: ...


BuildPreview = Callable[[object, dict[str, bool]], _PreviewReport]


@pytest.mark.parametrize(
    ("seed_path", "build_preview", "expected_count"),
    [
        (MATERIALS_SEED_PATH, build_materials_preview, 408),
        (FRAME_SEED_PATH, build_frame_preview, 189),
        (GLAZING_SEED_PATH, build_glazing_preview, 41),
    ],
    ids=["materials", "frames", "glazings"],
)
def test_catalog_seed_second_preview_inserts_nothing(
    seed_path: Path,
    build_preview: BuildPreview,
    expected_count: int,
) -> None:
    document = load_catalog_seed(seed_path)
    first_preview = build_preview(document, {})
    existing_ids = {str(row["id"]): True for row in first_preview.write_set.rows_to_insert}

    second_preview = build_preview(document, existing_ids)

    assert first_preview.counts.new == expected_count
    assert first_preview.counts.matched == 0
    assert first_preview.counts.errored == 0
    assert len(existing_ids) == expected_count
    assert second_preview.counts.new == 0
    assert second_preview.counts.matched == expected_count
    assert second_preview.counts.errored == 0
