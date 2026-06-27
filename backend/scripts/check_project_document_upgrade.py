"""Audit project-document bodies against the forward-only upgrade chain."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TypedDict, cast

from fastapi import HTTPException
from pydantic import ValidationError

from database import connection
from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
from features.project_document.fielddef_drift import (
    FieldDefDriftBaseline,
    TableFieldDefDriftReport,
    build_fielddef_drift_baseline,
    report_project_document_fielddef_drift,
    total_fielddef_drift,
)
from features.project_document.migrations import (
    ProjectDocumentMigrationError,
    SchemaVersionTooNewError,
    upgrade_project_document,
)
from features.project_document.validation import enforce_document_body_size, serialize_document

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURE_ROOT = ROOT / "tests" / "project_document_schema" / "fixtures"


@dataclass(frozen=True)
class AuditInput:
    source: str
    body: object


AuditFailureCode = Literal[
    "schema_version_too_new",
    "migration_error",
    "validation_error",
    "body_too_large",
    "fielddef_drift",
]


class AuditRecord(TypedDict):
    source: str
    schema_version: int | None
    ok: bool
    error_code: AuditFailureCode | None
    error_type: str | None
    error: str | None
    target_schema_version: int | None
    applied_steps: list[str]
    body_size_bytes: int | None
    preview_path: str | None
    fielddef_drift_count: int
    fielddef_drift: list[TableFieldDefDriftReport] | None


class LargestBody(TypedDict):
    source: str
    body_size_bytes: int


class BodySizeReport(TypedDict):
    largest: LargestBody | None


class AuditReport(TypedDict):
    ok: bool
    current_schema_version: int
    total_bodies: int
    schema_versions: dict[str, int]
    future_version_count: int
    invalid_count: int
    fielddef_drift_count: int
    upgrade_steps: dict[str, int]
    body_size_bytes: BodySizeReport
    records: list[AuditRecord]
    strict: bool


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit project-document bodies against schema upgrades.")
    parser.add_argument("--fixtures", action="store_true", help="Audit committed schema fixture inputs.")
    parser.add_argument("--json-dir", type=Path, help="Audit every *.json file under this directory.")
    parser.add_argument("--db", action="store_true", help="Audit local DB project_versions and project_version_drafts.")
    parser.add_argument("--fielddef-drift", action="store_true", help="Report built-in FieldDef drift in valid bodies.")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero when any body fails upgrade/validation.")
    parser.add_argument("--preview-dir", type=Path, help="Write upgraded current-schema JSON for valid bodies.")
    args = parser.parse_args(argv)

    if not args.fixtures and args.json_dir is None and not args.db:
        parser.error("Choose at least one source: --fixtures, --json-dir, or --db.")

    inputs: list[AuditInput] = []
    if args.fixtures:
        inputs.extend(iter_fixture_inputs(DEFAULT_FIXTURE_ROOT))
    if args.json_dir is not None:
        inputs.extend(iter_json_dir_inputs(args.json_dir))
    if args.db:
        inputs.extend(iter_db_inputs())

    report = audit_inputs(
        inputs,
        preview_dir=args.preview_dir,
        strict=args.strict,
        include_fielddef_drift=args.fielddef_drift,
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if args.strict and not report["ok"] else 0


def iter_fixture_inputs(root: Path = DEFAULT_FIXTURE_ROOT) -> list[AuditInput]:
    inputs: list[AuditInput] = []
    for version_dir in sorted(root.glob("v*")):
        input_dir = version_dir / "inputs"
        if not input_dir.is_dir():
            continue
        for path in sorted(input_dir.glob("*.json")):
            inputs.append(AuditInput(source=f"fixture:{version_dir.name}/{path.name}", body=_load_json_file(path)))
    return inputs


def iter_json_dir_inputs(root: Path) -> list[AuditInput]:
    if not root.is_dir():
        raise SystemExit(f"--json-dir does not exist or is not a directory: {root}")
    return [AuditInput(source=f"json:{path}", body=_load_json_file(path)) for path in sorted(root.rglob("*.json"))]


def iter_db_inputs() -> Iterator[AuditInput]:
    with connection() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        version_cursor = conn.execute(
            """
            SELECT id::text AS id, project_id::text AS project_id, schema_version, body
            FROM project_versions
            ORDER BY project_id, id
            """
        )
        for row in version_cursor:
            yield AuditInput(
                source=f"db:project_versions/{row['project_id']}/{row['id']}@row_schema={row['schema_version']}",
                body=row["body"],
            )
        draft_cursor = conn.execute(
            """
            SELECT version_id::text AS version_id, user_id::text AS user_id, schema_version, body
            FROM project_version_drafts
            ORDER BY version_id, user_id
            """
        )
        for row in draft_cursor:
            yield AuditInput(
                source=(
                    f"db:project_version_drafts/{row['version_id']}/{row['user_id']}@row_schema={row['schema_version']}"
                ),
                body=row["body"],
            )


def audit_inputs(
    inputs: Iterable[AuditInput],
    *,
    preview_dir: Path | None = None,
    strict: bool = False,
    include_fielddef_drift: bool = False,
) -> AuditReport:
    fielddef_baseline = build_fielddef_drift_baseline() if include_fielddef_drift else None
    records = [
        _audit_one(
            item,
            preview_dir=preview_dir,
            include_fielddef_drift=include_fielddef_drift,
            fielddef_baseline=fielddef_baseline,
        )
        for item in inputs
    ]
    schema_versions: dict[str, int] = {}
    upgrade_steps: dict[str, int] = {}
    largest: LargestBody | None = None
    for record in records:
        schema_key = str(record["schema_version"]) if record["schema_version"] is not None else "unknown"
        schema_versions[schema_key] = schema_versions.get(schema_key, 0) + 1
        for step in record["applied_steps"]:
            upgrade_steps[step] = upgrade_steps.get(step, 0) + 1
        size = record["body_size_bytes"]
        if size is not None and (largest is None or size > largest["body_size_bytes"]):
            largest = {"source": record["source"], "body_size_bytes": size}

    invalid_count = sum(1 for record in records if not record["ok"])
    future_count = sum(1 for record in records if record["error_code"] == "schema_version_too_new")
    fielddef_drift_count = sum(record["fielddef_drift_count"] for record in records)
    return {
        "ok": invalid_count == 0,
        "current_schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
        "total_bodies": len(records),
        "schema_versions": dict(sorted(schema_versions.items())),
        "future_version_count": future_count,
        "invalid_count": invalid_count,
        "fielddef_drift_count": fielddef_drift_count,
        "upgrade_steps": dict(sorted(upgrade_steps.items())),
        "body_size_bytes": {"largest": largest},
        "records": records,
        "strict": strict,
    }


def _audit_one(
    item: AuditInput,
    *,
    preview_dir: Path | None,
    include_fielddef_drift: bool,
    fielddef_baseline: FieldDefDriftBaseline | None,
) -> AuditRecord:
    schema_version = _schema_version(item.body)
    base: AuditRecord = {
        "source": item.source,
        "schema_version": schema_version,
        "ok": False,
        "error_code": None,
        "error_type": None,
        "error": None,
        "target_schema_version": None,
        "applied_steps": [],
        "body_size_bytes": None,
        "preview_path": None,
        "fielddef_drift_count": 0,
        "fielddef_drift": None,
    }
    try:
        result = upgrade_project_document(item.body)
        serialized = serialize_document(result.document)
        enforce_document_body_size(result.document, serialized)
    except (ProjectDocumentMigrationError, ValidationError, HTTPException) as exc:
        return {
            **base,
            "error_code": _failure_code(exc),
            "error_type": type(exc).__name__,
            "error": str(exc),
        }

    fielddef_drift = (
        report_project_document_fielddef_drift(result.document, baseline=fielddef_baseline)
        if include_fielddef_drift
        else None
    )
    fielddef_drift_count = total_fielddef_drift(fielddef_drift or [])
    preview_path = _write_preview(preview_dir, item.source, serialized.json_text) if preview_dir is not None else None
    return {
        **base,
        "ok": fielddef_drift_count == 0,
        "error_code": "fielddef_drift" if fielddef_drift_count > 0 else None,
        "error": (
            f"{fielddef_drift_count} built-in FieldDef drift item(s) detected" if fielddef_drift_count > 0 else None
        ),
        "target_schema_version": result.target_schema_version,
        "applied_steps": list(result.applied_steps),
        "body_size_bytes": serialized.size_bytes,
        "preview_path": str(preview_path) if preview_path is not None else None,
        "fielddef_drift_count": fielddef_drift_count,
        "fielddef_drift": fielddef_drift,
    }


def _load_json_file(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def _schema_version(raw: object) -> int | None:
    if isinstance(raw, dict):
        value = cast(dict[object, object], raw).get("schema_version")
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    return None


def _failure_code(exc: Exception) -> AuditFailureCode:
    if isinstance(exc, SchemaVersionTooNewError):
        return "schema_version_too_new"
    if isinstance(exc, ProjectDocumentMigrationError):
        return "migration_error"
    if isinstance(exc, ValidationError):
        return "validation_error"
    return "body_too_large"


def _write_preview(preview_dir: Path, source: str, json_text: str) -> Path:
    preview_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()[:12]
    filename = re.sub(r"[^A-Za-z0-9_.-]+", "_", source).strip("_") or "project_document"
    path = preview_dir / f"{filename}.{digest}.upgraded.json"
    path.write_text(json_text + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    raise SystemExit(main())
