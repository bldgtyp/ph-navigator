"""Phase 03 tests for the GH generic tables route.

Serializer parity is unit-tested on synthetic documents; route wiring + the
12-name allowlist is smoke-tested. All values are public-repo-safe synthetics.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from features.gh_api.tables_export import TABLE_PATHS, export_table
from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.rows import RoomRow
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from main import app
from tests.test_gh_api_foundation import _create_project, _gh_url
from tests.test_project_document import signed_in_client


def _document() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="GH Tables Fixture", bt_number="2700"))


def _option(option_id: str, label: str) -> SingleSelectOption:
    return SingleSelectOption(id=option_id, label=label, color="#123456", order=0.0)


def _field_def(field_key: str, field_type: CustomFieldType) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=field_key,
        field_type=field_type,
        origin="custom",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


# --- serializer -------------------------------------------------------------


def test_builtin_single_select_denormalized_and_custom_values_passed_through() -> None:
    body = _document()
    body.single_select_options["rooms.floor_level"] = [_option("opt_floor1", "Level 1")]
    body.tables.rooms.rows = [
        RoomRow(id="rm_1", floor_level="opt_floor1", custom_values={"name": "Living", "number": "101"})
    ]

    result = export_table(body, "rooms")
    assert result["field_defs"]  # built-in seeds present
    (record,) = result["records"]
    assert record["floor_level"] == {"id": "opt_floor1", "label": "Level 1"}
    assert record["building_zone"] is None  # unset single-select stays null
    assert record["custom_values"]["name"] == "Living"  # bag passed through verbatim


def test_custom_single_select_field_is_denormalized() -> None:
    body = _document()
    body.tables.rooms.field_defs.append(_field_def("cf_pick", CustomFieldType.single_select))
    body.single_select_options["rooms.cf_pick"] = [_option("opt_pick9", "Chosen")]
    body.tables.rooms.rows = [RoomRow(id="rm_1", custom_values={"cf_pick": "opt_pick9"})]

    (record,) = export_table(body, "rooms")["records"]
    assert record["custom_values"]["cf_pick"] == {"id": "opt_pick9", "label": "Chosen"}


def test_unknown_single_select_option_resolves_to_null_label() -> None:
    body = _document()
    body.tables.rooms.rows = [RoomRow(id="rm_1", floor_level="opt_missing")]
    (record,) = export_table(body, "rooms")["records"]
    assert record["floor_level"] == {"id": "opt_missing", "label": None}


def test_unknown_table_name_is_422_listing_valid_names() -> None:
    with pytest.raises(HTTPException) as excinfo:
        export_table(_document(), "widgets")
    assert excinfo.value.status_code == 422
    detail = excinfo.value.detail
    assert isinstance(detail, dict)
    assert set(detail["details"]["valid_names"]) == set(TABLE_PATHS)


def test_empty_table_returns_empty_records_not_error() -> None:
    result = export_table(_document(), "heat_pump_indoor_units")
    assert result["records"] == []
    assert isinstance(result["field_defs"], list)


def test_every_allowlisted_table_serializes() -> None:
    body = _document()
    for name in TABLE_PATHS:
        result = export_table(body, name)
        assert set(result) == {"field_defs", "records"}


# --- route ------------------------------------------------------------------


def test_table_routes_smoke_and_client_shape(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2700")
    anon = TestClient(app)

    for name in TABLE_PATHS:
        response = anon.get(f"{_gh_url('2700')}/tables/{name}")
        assert response.status_code == 200, response.text
        payload = response.json()
        # Client-shape: single json parse, dict-key access, JSON-native values only.
        assert json.loads(json.dumps(payload)) == payload
        assert payload["records"] == []
        assert isinstance(payload["field_defs"], list)
        assert payload["schema_version"] == 1


def test_table_route_unknown_name_returns_422(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2700")
    response = TestClient(app).get(f"{_gh_url('2700')}/tables/widgets")
    assert response.status_code == 422
    assert response.json()["error_code"] == "unknown_table"
