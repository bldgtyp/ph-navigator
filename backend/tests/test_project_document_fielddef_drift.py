"""Tests for built-in FieldDef drift reporting."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, cast

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1
from features.project_document.fielddef_drift import (
    report_project_document_fielddef_drift,
    total_fielddef_drift,
)
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from scripts.check_project_document_upgrade import AuditInput, audit_inputs, iter_fixture_inputs


def _body_json() -> dict[str, Any]:
    return empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[])).model_dump(
        mode="json"
    )


def test_fielddef_drift_report_is_empty_for_current_seeded_document() -> None:
    body = empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))

    report = report_project_document_fielddef_drift(body)

    assert total_fielddef_drift(report) == 0


def test_fielddef_drift_reports_builtin_label_type_config_and_namespace_changes() -> None:
    raw = _body_json()
    rooms = cast(dict[str, Any], cast(dict[str, Any], raw["tables"])["rooms"])
    field_defs = cast(list[dict[str, Any]], rooms["field_defs"])
    number = next(field for field in field_defs if field["field_key"] == "number")
    number["display_name"] = "Room No."
    number["field_type"] = "number"
    number["config"] = {
        "units": {
            "mode": "fixed",
            "unit_type": "area",
            "si_unit": "m2",
            "ip_unit": "ft2",
            "precision_si": 1,
            "precision_ip": 1,
        }
    }
    drifted = ProjectDocumentV1.model_validate(raw)
    options = dict(drifted.single_select_options)
    del options["rooms.floor_level"]
    drifted = drifted.model_copy(update={"single_select_options": options})

    report = report_project_document_fielddef_drift(drifted)
    rooms_report = next(table for table in report if table["table"] == "rooms")

    assert total_fielddef_drift(report) == 2
    assert rooms_report["drift"][0]["kind"] == "field_shape_changed"
    changed_fields = {diff["field"] for diff in rooms_report["drift"][0]["differences"]}
    assert {"display_name", "field_type", "config"}.issubset(changed_fields)
    assert rooms_report["drift"][1]["kind"] == "missing_option_namespace"
    assert rooms_report["drift"][1]["field_key"] == "floor_level"


def test_fielddef_drift_ignores_custom_fields() -> None:
    body = empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))
    custom = TableFieldDef(
        field_key="cf_notes",
        display_name="Notes",
        field_type=CustomFieldType.long_text,
        origin="custom",
        created_at=datetime(2026, 6, 27, tzinfo=UTC),
    )
    rooms = body.tables.rooms.model_copy(update={"field_defs": [*body.tables.rooms.field_defs, custom]})
    drifted = body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": rooms})})

    report = report_project_document_fielddef_drift(drifted)
    rooms_report = next(table for table in report if table["table"] == "rooms")

    assert total_fielddef_drift(report) == 0
    assert rooms_report["custom_field_count"] == 1


def test_fielddef_drift_reports_missing_extra_and_origin_mismatch() -> None:
    raw = _body_json()
    rooms = cast(dict[str, Any], cast(dict[str, Any], raw["tables"])["rooms"])
    field_defs = cast(list[dict[str, Any]], rooms["field_defs"])
    number = next(field for field in field_defs if field["field_key"] == "number")
    number["origin"] = "custom"
    field_defs[:] = [field for field in field_defs if field["field_key"] != "name"]
    stale = deepcopy(number)
    stale["field_key"] = "stale_builtin"
    stale["display_name"] = "Stale Built-In"
    stale["origin"] = "built_in"
    field_defs.append(stale)
    body = ProjectDocumentV1.model_validate(raw)

    report = report_project_document_fielddef_drift(body)
    rooms_report = next(table for table in report if table["table"] == "rooms")
    drift_by_key = {item["field_key"]: item["kind"] for item in rooms_report["drift"]}

    assert drift_by_key["number"] == "origin_mismatch"
    assert drift_by_key["name"] == "missing_built_in"
    assert drift_by_key["stale_builtin"] == "extra_built_in"


def test_audit_cli_fielddef_drift_mode_fails_strict_on_seed_drift() -> None:
    raw = cast(dict[str, Any], deepcopy(iter_fixture_inputs()[0].body))
    rooms = cast(dict[str, Any], cast(dict[str, Any], raw["tables"])["rooms"])
    field_defs = cast(list[dict[str, Any]], rooms["field_defs"])
    field_defs[0]["display_name"] = "Changed"

    report = audit_inputs(
        [AuditInput(source="drifted", body=raw)],
        strict=True,
        include_fielddef_drift=True,
    )

    assert report["ok"] is False
    assert report["fielddef_drift_count"] == 1
    assert report["invalid_count"] == 1
    record = report["records"][0]
    assert record["error_code"] == "fielddef_drift"
    assert record["fielddef_drift_count"] == 1


def test_audit_cli_fielddef_drift_mode_keeps_current_fixtures_clean() -> None:
    report = audit_inputs(iter_fixture_inputs(), include_fielddef_drift=True)

    assert report["ok"] is True
    assert report["fielddef_drift_count"] == 0
    for record in report["records"]:
        assert record["fielddef_drift"] is not None
        assert all(table["drift_count"] == 0 for table in record["fielddef_drift"])
