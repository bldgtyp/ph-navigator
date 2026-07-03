"""Tests for the project-document schema audit CLI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
from scripts.check_project_document_upgrade import (
    AuditInput,
    audit_inputs,
    iter_fixture_inputs,
    iter_json_dir_inputs,
    main,
)


def test_project_document_upgrade_audit_reports_fixture_corpus() -> None:
    report = audit_inputs(iter_fixture_inputs())

    assert report["ok"] is True
    assert report["total_bodies"] == 2
    assert report["schema_versions"] == {"1": 2}
    assert report["invalid_count"] == 0
    assert report["future_version_count"] == 0
    largest = report["body_size_bytes"]["largest"]
    assert largest is not None
    assert largest["body_size_bytes"] > 0


def test_project_document_upgrade_audit_classifies_invalid_and_future_bodies(
    tmp_path: Path,
) -> None:
    valid_body = cast(dict[str, Any], iter_fixture_inputs()[0].body)
    future_body = dict(valid_body)
    future_body["schema_version"] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION + 1
    missing_body = dict(valid_body)
    del missing_body["schema_version"]

    report = audit_inputs(
        [
            AuditInput(source="valid", body=valid_body),
            AuditInput(source="future", body=future_body),
            AuditInput(source="missing", body=missing_body),
        ],
        preview_dir=tmp_path,
    )

    assert report["ok"] is False
    assert report["total_bodies"] == 3
    assert report["invalid_count"] == 2
    assert report["future_version_count"] == 1
    records = {record["source"]: record for record in report["records"]}
    assert records["valid"]["ok"] is True
    assert records["valid"]["preview_path"]
    assert records["future"]["error_code"] == "schema_version_too_new"
    assert records["future"]["error_type"] == "SchemaVersionTooNewError"
    assert records["missing"]["error_code"] == "migration_error"
    assert records["missing"]["error_type"] == "SchemaVersionMissingError"


def test_project_document_upgrade_audit_reads_json_directory(tmp_path: Path) -> None:
    source = iter_fixture_inputs()[0].body
    (tmp_path / "nested").mkdir()
    (tmp_path / "nested" / "project.json").write_text(json.dumps(source), encoding="utf-8")

    inputs = iter_json_dir_inputs(tmp_path)
    report = audit_inputs(inputs)

    assert [item.source for item in inputs] == [f"json:{tmp_path / 'nested' / 'project.json'}"]
    assert report["ok"] is True
    assert report["total_bodies"] == 1


def test_project_document_upgrade_audit_strict_mode_exits_nonzero_for_invalid_body(
    tmp_path: Path,
    capsys,
) -> None:
    source = cast(dict[str, Any], iter_fixture_inputs()[0].body)
    source["schema_version"] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION + 1
    (tmp_path / "future.json").write_text(json.dumps(source), encoding="utf-8")

    exit_code = main(["--json-dir", str(tmp_path), "--strict"])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert '"future_version_count": 1' in captured.out


def test_project_document_upgrade_audit_preview_paths_are_collision_safe(
    tmp_path: Path,
) -> None:
    body = iter_fixture_inputs()[0].body
    report = audit_inputs(
        [
            AuditInput(source="json:a/b.json", body=body),
            AuditInput(source="json:a_b.json", body=body),
        ],
        preview_dir=tmp_path,
    )

    previews = [record["preview_path"] for record in report["records"]]
    assert len(set(previews)) == 2
    for preview in previews:
        assert preview is not None
        assert Path(preview).exists()
