"""Schema fingerprint guard for project-document evolution."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict, cast

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
from features.project_document.fielddef_drift import current_project_document_schema_fingerprint
from scripts.check_project_document_upgrade import DEFAULT_FIXTURE_ROOT, iter_fixture_inputs

SCHEMA_GUARD_PATH = Path(__file__).parent / "project_document_schema" / "schema_fingerprint.json"


class SchemaFingerprintGuard(TypedDict):
    schema_version: int
    fingerprint: str
    fixture_versions: list[str]
    fixture_input_count: int


def test_project_document_schema_fingerprint_requires_version_guard_update() -> None:
    guard = cast(SchemaFingerprintGuard, json.loads(SCHEMA_GUARD_PATH.read_text(encoding="utf-8")))

    current_fixture_versions = sorted(path.name for path in DEFAULT_FIXTURE_ROOT.glob("v*") if path.is_dir())
    current_fixture_count = len(iter_fixture_inputs(DEFAULT_FIXTURE_ROOT))

    assert guard["schema_version"] == CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    assert guard["fingerprint"] == current_project_document_schema_fingerprint()
    assert guard["fixture_versions"] == current_fixture_versions
    assert guard["fixture_input_count"] == current_fixture_count
