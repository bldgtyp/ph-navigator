"""Smoke test for the committed glazing-types seed JSON.

Loads `features/catalogs/glazing_types/seeds/glazing-types.v1.json` and
runs it through the preview pipeline against an empty catalog. Catches
seed-file rot (someone breaks the schema or accidentally regenerates
with bad data) without needing a live DB roundtrip.
"""

from __future__ import annotations

import json
import pathlib

from features.catalogs.glazing_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from features.catalogs.glazing_types.import_export.pipeline import build_preview

SEED_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "features"
    / "catalogs"
    / "glazing_types"
    / "seeds"
    / "glazing-types.v1.json"
)


def test_seed_file_parses_and_passes_the_pipeline_cleanly() -> None:
    payload = json.loads(SEED_PATH.read_text())
    assert payload["kind"] == FILE_KIND
    assert payload["schema_version"] == CURRENT_SCHEMA_VERSION

    report = build_preview(payload, existing_ids={})
    assert report.counts.errored == 0, [error.reason for error in report.errors]
    # All seed rows become new inserts (no `id`s shipped in the file).
    assert report.counts.new == len(payload["rows"])
    assert report.counts.matched == 0
    assert report.counts.warnings == 0


def test_seed_file_carries_the_full_airtable_export() -> None:
    payload = json.loads(SEED_PATH.read_text())
    # The CSV source has 43 rows after the header; bumping this number
    # is intentional and should require a code change.
    assert len(payload["rows"]) == 43
