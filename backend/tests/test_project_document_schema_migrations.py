"""Golden corpus tests for project-document schema evolution."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
from features.project_document.migrations import upgrade_project_document
from features.project_document.validation import enforce_document_body_size, serialize_document

FIXTURE_ROOT = Path(__file__).parent / "project_document_schema" / "fixtures"


@dataclass(frozen=True)
class CorpusCase:
    version: int
    name: str
    input_path: Path
    expected_path: Path


def _corpus_cases() -> list[CorpusCase]:
    cases: list[CorpusCase] = []
    for version_dir in sorted(FIXTURE_ROOT.glob("v*")):
        if not version_dir.is_dir() or not version_dir.name[1:].isdigit():
            continue
        version = int(version_dir.name[1:])
        for input_path in sorted((version_dir / "inputs").glob("*.json")):
            cases.append(
                CorpusCase(
                    version=version,
                    name=input_path.stem,
                    input_path=input_path,
                    expected_path=version_dir / "expected" / input_path.name,
                )
            )
    return cases


CORPUS_CASES = _corpus_cases()


def _load_raw_fixture(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(raw, dict)
    return raw


@pytest.mark.parametrize("case", CORPUS_CASES, ids=lambda case: f"v{case.version}/{case.name}")
def test_project_document_fixture_upgrades_to_committed_canonical_snapshot(case: CorpusCase) -> None:
    raw = _load_raw_fixture(case.input_path)

    result = upgrade_project_document(raw)
    serialized = serialize_document(result.document)
    expected_text = case.expected_path.read_text(encoding="utf-8")

    assert result.original_schema_version == case.version
    assert result.target_schema_version == CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    if case.version == CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION:
        assert result.applied_steps == ()
        assert result.requires_persisted_rewrite is False
    else:
        assert result.applied_steps
        assert result.requires_persisted_rewrite is True
    assert serialized.json_text + "\n" == expected_text
    assert enforce_document_body_size(result.document, serialized) == serialized

    idempotent = upgrade_project_document(json.loads(serialized.json_text))
    assert serialize_document(idempotent.document).json_text == serialized.json_text
    expected = upgrade_project_document(json.loads(expected_text))
    assert serialize_document(expected.document).json_text + "\n" == expected_text
