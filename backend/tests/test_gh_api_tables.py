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
from features.project_document.document import (
    ROOM_VENTILATOR_FIELD_KEY,
    ProjectDocumentV1,
    PumpRow,
    SingleSelectOption,
    VentilatorRow,
)
from features.project_document.formula import ast_to_json, build_field_registry, parse, resolve_refs
from features.project_document.rows import RoomRow
from features.project_document.tables.rooms import rooms_field_registry
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from main import app
from tests.test_gh_api_foundation import _create_project, _gh_url
from tests.test_project_document import signed_in_client


def _document() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="GH Tables Fixture", bt_number="2700"))


def _option(option_id: str, label: str) -> SingleSelectOption:
    return SingleSelectOption(id=option_id, label=label, color="#123456", order=0.0)


def _field_def(field_key: str, field_type: CustomFieldType, config: dict[str, object] | None = None) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=field_key,
        field_type=field_type,
        config=config or {},
        origin="custom",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def _formula_config(body: ProjectDocumentV1, source: str, deps: list[str] | None = None) -> dict[str, object]:
    """A numeric formula config with references resolved against the live schema.

    `resolve_refs` is inert for a ref-less source (`"1 / 0"`), so the same helper
    serves both literal and field-referencing formulas.
    """
    resolved = resolve_refs(parse(source), build_field_registry(rooms_field_registry, body))
    return {"source": source, "ast": ast_to_json(resolved), "deps": deps or [], "result_type": "number"}


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


# --- computed/formula values (Phase 1, D8/D10) ------------------------------


def test_formula_value_exported_inline() -> None:
    body = _document()
    body.tables.rooms.field_defs.append(
        _field_def("cf_load", CustomFieldType.formula, _formula_config(body, "{People} * 10", ["num_people"]))
    )
    body.tables.rooms.rows = [RoomRow(id="rm_1", custom_values={"num_people": 3})]

    (record,) = export_table(body, "rooms")["records"]
    # A formula has no stored cell; its resolved value drops in inline by field_key.
    assert record["cf_load"] == 30.0


def test_formula_error_row_exports_null() -> None:
    body = _document()
    body.tables.rooms.field_defs.append(_field_def("cf_bad", CustomFieldType.formula, _formula_config(body, "1 / 0")))
    body.tables.rooms.rows = [RoomRow(id="rm_1")]

    (record,) = export_table(body, "rooms")["records"]
    assert record["cf_bad"] is None  # #ERROR is exported as null, never a marker string


def test_non_rooms_table_formula_exported() -> None:
    body = _document()
    body.tables.equipment.pumps.field_defs.append(
        _field_def("cf_calc", CustomFieldType.formula, _formula_config(body, "10 + 5"))
    )
    body.tables.equipment.pumps.rows = [PumpRow(id="pmp_1")]

    (record,) = export_table(body, "pumps")["records"]
    assert record["cf_calc"] == 15.0  # generality: computed values land on every FieldDef table


def test_table_without_formulas_gains_no_extra_keys() -> None:
    body = _document()
    body.tables.rooms.rows = [RoomRow(id="rm_1", custom_values={"name": "Living"})]
    (record,) = export_table(body, "rooms")["records"]
    assert not any(key.startswith("cf_") for key in record)  # no formula overlay keys leak in


def test_reverse_link_ids_are_exported_on_target_records() -> None:
    body = _document()
    body.tables.rooms.rows = [
        RoomRow(
            id="rm_1",
            custom_values={"number": "101", "name": "Living Room"},
            custom_links={ROOM_VENTILATOR_FIELD_KEY: ["vent_1"]},
        )
    ]
    body.tables.equipment.ervs.rows = [
        VentilatorRow(id="vent_1", custom_values={"record_id": "ERV-1", "name": "Main ERV"})
    ]

    (record,) = export_table(body, "ventilators")["records"]

    assert record["inverse_links"] == {"rooms.ventilator_id": ["rm_1"]}


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
