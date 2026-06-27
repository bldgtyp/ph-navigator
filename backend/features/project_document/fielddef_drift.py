"""Built-in FieldDef drift reporting for persisted project documents."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal, TypedDict

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1
from features.project_document.options import option_list_key
from features.project_document.tables._status_field import STATUS_FIELD_KEY, status_option_key
from features.project_document.tables.registry import iter_table_contracts
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest

FieldDefDriftKind = Literal[
    "missing_built_in",
    "extra_built_in",
    "origin_mismatch",
    "field_shape_changed",
    "missing_option_namespace",
]


class FieldDefDifference(TypedDict):
    field: str
    expected: object
    actual: object


class FieldDefDriftItem(TypedDict):
    table: str
    table_path: list[str]
    field_key: str
    kind: FieldDefDriftKind
    differences: list[FieldDefDifference]


class TableFieldDefDriftReport(TypedDict):
    table: str
    table_path: list[str]
    drift_count: int
    custom_field_count: int
    drift: list[FieldDefDriftItem]


@dataclass(frozen=True)
class TableFieldDefBaseline:
    table_path: tuple[str, ...]
    built_ins: dict[str, TableFieldDef]
    option_namespaces: dict[str, str]


@dataclass(frozen=True)
class FieldDefDriftBaseline:
    tables: dict[str, TableFieldDefBaseline]


def build_fielddef_drift_baseline() -> FieldDefDriftBaseline:
    """Snapshot the current seeded built-in FieldDef contract once per audit."""

    current = _current_project_document()
    tables: dict[str, TableFieldDefBaseline] = {}
    for contract in iter_table_contracts():
        registry = contract.field_registry
        if registry is None:
            continue
        current_fields = registry.read_field_defs(current)
        built_ins = {field.field_key: field for field in current_fields if field.origin == "built_in"}
        option_namespaces = {
            field.field_key: _option_namespace(
                contract.name,
                registry.table_path,
                registry.built_in_option_key_by_field_key,
                field.field_key,
            )
            for field in built_ins.values()
            if field.field_type is CustomFieldType.single_select
        }
        tables[contract.name] = TableFieldDefBaseline(
            table_path=registry.table_path,
            built_ins=built_ins,
            option_namespaces=option_namespaces,
        )
    return FieldDefDriftBaseline(tables=tables)


def report_project_document_fielddef_drift(
    body: ProjectDocumentV1,
    *,
    baseline: FieldDefDriftBaseline | None = None,
    include_clean: bool = False,
) -> list[TableFieldDefDriftReport]:
    """Compare persisted built-in FieldDefs to the current seed contract.

    Custom fields are counted for operator visibility but are not product
    drift. The persisted `origin` flag is the source of truth for whether a
    FieldDef came from the product seed.
    """

    current_baseline = baseline or build_fielddef_drift_baseline()
    reports: list[TableFieldDefDriftReport] = []
    for contract in iter_table_contracts():
        registry = contract.field_registry
        if registry is None:
            continue
        table_baseline = current_baseline.tables[contract.name]

        persisted_fields = registry.read_field_defs(body)
        persisted_by_key = {field.field_key: field for field in persisted_fields}
        persisted_built_ins = {field.field_key: field for field in persisted_fields if field.origin == "built_in"}
        drift: list[FieldDefDriftItem] = []

        for field_key, expected in table_baseline.built_ins.items():
            actual = persisted_by_key.get(field_key)
            if actual is None:
                drift.append(_drift_item(contract.name, registry.table_path, field_key, "missing_built_in"))
                continue
            if actual.origin != "built_in":
                drift.append(
                    _drift_item(
                        contract.name,
                        registry.table_path,
                        field_key,
                        "origin_mismatch",
                        differences=[
                            {"field": "origin", "expected": "built_in", "actual": actual.origin},
                        ],
                    )
                )
                continue

            differences = _field_differences(expected, actual)
            if differences:
                drift.append(
                    _drift_item(
                        contract.name,
                        registry.table_path,
                        field_key,
                        "field_shape_changed",
                        differences=differences,
                    )
                )

            if expected.field_type is CustomFieldType.single_select:
                namespace = table_baseline.option_namespaces[field_key]
                if namespace not in body.single_select_options:
                    drift.append(
                        _drift_item(
                            contract.name,
                            registry.table_path,
                            field_key,
                            "missing_option_namespace",
                            differences=[
                                {"field": "single_select_options", "expected": namespace, "actual": None},
                            ],
                        )
                    )

        for field_key in sorted(set(persisted_built_ins).difference(table_baseline.built_ins)):
            actual = persisted_built_ins[field_key]
            drift.append(
                _drift_item(
                    contract.name,
                    registry.table_path,
                    field_key,
                    "extra_built_in",
                    differences=[
                        {"field": "field_def", "expected": None, "actual": _canonical_field_def(actual)},
                    ],
                )
            )

        custom_field_count = sum(1 for field in persisted_fields if field.origin == "custom")
        if not include_clean and not drift and custom_field_count == 0:
            continue
        reports.append(
            {
                "table": contract.name,
                "table_path": list(registry.table_path),
                "drift_count": len(drift),
                "custom_field_count": custom_field_count,
                "drift": drift,
            }
        )
    return reports


def total_fielddef_drift(reports: Iterable[TableFieldDefDriftReport]) -> int:
    return sum(report["drift_count"] for report in reports)


def current_project_document_schema_fingerprint_payload() -> dict[str, object]:
    """Return the deterministic payload guarded by the schema fingerprint test."""

    baseline = build_fielddef_drift_baseline()
    field_defs: dict[str, list[dict[str, object]]] = {}
    option_namespaces: dict[str, list[str]] = {}
    for table_name, table_baseline in baseline.tables.items():
        field_defs[table_name] = [_canonical_field_def(field) for field in table_baseline.built_ins.values()]
        option_namespaces[table_name] = list(table_baseline.option_namespaces.values())

    return {
        "project_document_json_schema": ProjectDocumentV1.model_json_schema(),
        "built_in_field_defs": field_defs,
        "built_in_option_namespaces": option_namespaces,
    }


def current_project_document_schema_fingerprint() -> str:
    payload = current_project_document_schema_fingerprint_payload()
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _current_project_document() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="Schema Contract", bt_number="BT-SCHEMA", cert_programs=[]))


def _field_differences(expected: TableFieldDef, actual: TableFieldDef) -> list[FieldDefDifference]:
    differences: list[FieldDefDifference] = []
    expected_dump = _canonical_field_def(expected)
    actual_dump = _canonical_field_def(actual)
    for key in ("display_name", "field_type", "config", "default", "description"):
        if expected_dump[key] != actual_dump[key]:
            differences.append(
                {
                    "field": key,
                    "expected": expected_dump[key],
                    "actual": actual_dump[key],
                }
            )
    return differences


def _canonical_field_def(field: TableFieldDef) -> dict[str, object]:
    raw = field.model_dump(mode="json")
    return {
        "field_key": raw["field_key"],
        "display_name": raw["display_name"],
        "field_type": raw["field_type"],
        "config": raw["config"],
        "description": raw["description"],
        "default": raw["default"],
        "origin": raw["origin"],
    }


def _option_namespace(
    table_name: str,
    table_path: tuple[str, ...],
    built_in_option_key_by_field_key: dict[str, str],
    field_key: str,
) -> str:
    if field_key == STATUS_FIELD_KEY:
        return status_option_key(table_name)
    return built_in_option_key_by_field_key.get(field_key, option_list_key(table_path, field_key))


def _drift_item(
    table: str,
    table_path: tuple[str, ...],
    field_key: str,
    kind: FieldDefDriftKind,
    *,
    differences: list[FieldDefDifference] | None = None,
) -> FieldDefDriftItem:
    return {
        "table": table,
        "table_path": list(table_path),
        "field_key": field_key,
        "kind": kind,
        "differences": differences or [],
    }
