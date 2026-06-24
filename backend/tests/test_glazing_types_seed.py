"""Smoke test for the committed glazing-types seed JSON.

Loads `backend/seeds/catalogs/glazing-types.v1.json` and runs it through
the preview pipeline against an empty catalog. Catches seed-file rot
(someone breaks the schema or accidentally regenerates with bad data)
without needing a live DB roundtrip.
"""

from __future__ import annotations

import json

from features.catalogs.glazing_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from features.catalogs.glazing_types.import_export.pipeline import build_preview
from scripts._seed_paths import GLAZING_SEED_PATH

SEED_PATH = GLAZING_SEED_PATH


def test_seed_file_parses_and_passes_the_pipeline_cleanly() -> None:
    payload = json.loads(SEED_PATH.read_text())
    assert payload["kind"] == FILE_KIND
    # The seed is a frozen v1 AirTable export; the importer upgrades it to the
    # current schema on load, so it is intentionally older than CURRENT.
    assert payload["schema_version"] == 1
    assert payload["schema_version"] < CURRENT_SCHEMA_VERSION

    report = build_preview(payload, existing_ids={})
    assert report.counts.errored == 0, [error.reason for error in report.errors]
    # All seed rows become new inserts (no `id`s shipped in the file).
    assert report.counts.new == len(payload["rows"])
    assert report.counts.matched == 0
    assert report.counts.warnings == 0


def test_seed_file_carries_the_full_airtable_export() -> None:
    payload = json.loads(SEED_PATH.read_text())
    # The CSV source had 43 rows; window-glass-catalog-enums Phase 0 dropped the
    # two `DEFAULT` artifact rows (D-6), leaving 41. Bumping this number is
    # intentional and should require a code change.
    assert len(payload["rows"]) == 41
