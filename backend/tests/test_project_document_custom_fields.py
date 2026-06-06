"""Field registry contract + fingerprint tests for plan-14 P1.2."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import pytest
from pydantic import ValidationError

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
    coerce_custom_value,
    number_unit_registry_snapshot,
)
from features.project_document.document import ProjectDocumentV1, RoomRow
from features.project_document.tables import get_table_contract
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_KEYS, rooms_field_registry
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
        )
    )


def _make_custom_field(
    field_key: str,
    display_name: str = "Notes",
    field_type: CustomFieldType = CustomFieldType.short_text,
) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=field_type,
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def _make_number_units_config(**overrides: object) -> dict[str, object]:
    return {
        "mode": "editable",
        "unit_type": "density",
        "si_unit": "kg_m3",
        "ip_unit": "lb_ft3",
        "precision_si": 1,
        "precision_ip": 2,
        **overrides,
    }


def test_rooms_contract_exposes_field_registry() -> None:
    rooms = get_table_contract("rooms")
    window_types = get_table_contract("window_types")

    assert rooms.field_registry is not None
    assert rooms.table_path == ("rooms",)
    assert rooms.field_registry.field_keys == ROOMS_BUILT_IN_FIELD_KEYS
    assert rooms.field_registry.option_list_namespace_prefix == "rooms"

    assert window_types.field_registry is None
    assert window_types.table_path == ("window_types",)


def test_rooms_fingerprint_changes_when_custom_field_added() -> None:
    rooms = get_table_contract("rooms")
    assert rooms.field_registry is not None

    empty = _empty_body()
    empty_fp = rooms.field_registry.compute_schema_fingerprint(empty)

    with_field = rooms.field_registry.replace_field_defs(
        empty,
        [*rooms.field_registry.read_field_defs(empty), _make_custom_field("cf_notes")],
    )
    populated_fp = rooms.field_registry.compute_schema_fingerprint(with_field)

    assert empty_fp != populated_fp


def test_fingerprint_independent_of_display_name_changes() -> None:
    a = compute_table_schema_fingerprint([_make_custom_field("cf_x", "Alpha")])
    b = compute_table_schema_fingerprint([_make_custom_field("cf_x", "Beta")])
    assert a == b


def test_fingerprint_changes_when_field_type_changes() -> None:
    short_field = _make_custom_field("cf_x", "Notes")
    number_field = short_field.model_copy(update={"field_type": CustomFieldType.number})
    a = compute_table_schema_fingerprint([short_field])
    b = compute_table_schema_fingerprint([number_field])
    assert a != b


def test_number_field_accepts_complete_units_config() -> None:
    field = TableFieldDef(
        field_key="cf_density",
        display_name="Density",
        field_type=CustomFieldType.number,
        config={"precision": 2, "units": _make_number_units_config(precision_ip=99)},
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )

    assert field.config["units"] == {
        "mode": "editable",
        "unit_type": "density",
        "si_unit": "kg_m3",
        "ip_unit": "lb_ft3",
        "precision_si": 1,
        "precision_ip": 10,
    }


@pytest.mark.parametrize(
    "config",
    [
        {"units": {"mode": "editable"}},
        {"units": _make_number_units_config(unit_type="density", si_unit="m")},
        {"units": _make_number_units_config(mode="readonly")},
        {"units": _make_number_units_config(unit_type="unknown")},
    ],
)
def test_number_field_rejects_invalid_units_config(config: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TableFieldDef(
            field_key="cf_bad",
            display_name="Bad",
            field_type=CustomFieldType.number,
            config=config,
            created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
            created_by=None,
        )


def test_non_number_field_rejects_units_config() -> None:
    with pytest.raises(ValidationError):
        TableFieldDef(
            field_key="cf_text",
            display_name="Text",
            field_type=CustomFieldType.short_text,
            config={"units": _make_number_units_config()},
            created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
            created_by=None,
        )


def test_number_unit_registry_snapshot_matches_frontend_contract() -> None:
    assert number_unit_registry_snapshot() == {
        "density": {"si": ["kg_m3"], "ip": ["lb_ft3"]},
        "conductivity": {"si": ["w_m_k"], "ip": ["btu_h_ft_f"]},
        "u_value": {"si": ["w_m2_k"], "ip": ["btu_h_ft2_f"]},
        "specific_heat": {"si": ["j_kg_k"], "ip": ["btu_lb_f"]},
        "length": {"si": ["m"], "ip": ["ft"]},
        "area": {"si": ["m2"], "ip": ["ft2"]},
        "volume": {"si": ["m3"], "ip": ["ft3"]},
        "airflow": {"si": ["m3_h"], "ip": ["cfm"]},
        "volume_liters": {"si": ["l"], "ip": ["gal"]},
        "temperature": {"si": ["c"], "ip": ["f"]},
        "electric_efficiency": {"si": ["wh_m3"], "ip": ["w_cfm"]},
    }


def test_empty_fingerprint_matches_pinned_parity_digest() -> None:
    """Pin the empty-table digest so the backend + frontend SHA-256
    parity is enforced on both sides. The matching frontend assertion
    lives in `useTableSchema.test.ts`."""
    assert compute_table_schema_fingerprint([]) == "7bb25519cabb2abaf1a6c64ca8ce25f69cd16d656604bfb58509adb79187ce90"


def test_rooms_registry_replace_round_trips_field_defs() -> None:
    body = _empty_body()
    field_defs = [*rooms_field_registry.read_field_defs(body), _make_custom_field("cf_a")]

    next_body = rooms_field_registry.replace_field_defs(body, field_defs)

    assert rooms_field_registry.read_field_defs(next_body) == field_defs


def test_color_custom_value_coercion_normalizes_nullable_values() -> None:
    assert coerce_custom_value("#AABBCC", CustomFieldType.color) == "#aabbcc"
    assert coerce_custom_value("  #DCE6F0  ", CustomFieldType.color) == "#dce6f0"
    assert coerce_custom_value("", CustomFieldType.color) is None
    assert coerce_custom_value(None, CustomFieldType.color) is None


@pytest.mark.parametrize("raw_value", ["#abc", "#aabbccdd", "red", (255, 220, 230, 240), 123])
def test_color_custom_value_coercion_rejects_non_hex_storage(raw_value: object) -> None:
    with pytest.raises(ValueError):
        coerce_custom_value(raw_value, CustomFieldType.color)


def test_project_document_validates_color_custom_values() -> None:
    body = _empty_body()
    color_field = _make_custom_field("cf_color", "Material Color", CustomFieldType.color)
    body = rooms_field_registry.replace_field_defs(
        body,
        [*rooms_field_registry.read_field_defs(body), color_field],
    )
    row = RoomRow(
        id="rm_1",
        floor_level=None,
        building_zone=None,
        icfa_factor=1.0,
        erv_unit_ids=[],
        catalog_origin=None,
        notes=None,
        custom_values=cast(
            dict[str, str | int | float | bool | None],
            {
                "number": "101",
                "name": "Living",
                "num_people": 0,
                "num_bedrooms": 0,
                "cf_color": "#dce6f0",
            },
        ),
    )
    next_tables = body.tables.model_copy(update={"rooms": body.tables.rooms.model_copy(update={"rows": [row]})})

    ProjectDocumentV1.model_validate(body.model_copy(update={"tables": next_tables}).model_dump(mode="json"))


def test_project_document_rejects_invalid_color_custom_values() -> None:
    body = _empty_body()
    color_field = _make_custom_field("cf_color", "Material Color", CustomFieldType.color)
    body = rooms_field_registry.replace_field_defs(
        body,
        [*rooms_field_registry.read_field_defs(body), color_field],
    )
    row = RoomRow(
        id="rm_1",
        floor_level=None,
        building_zone=None,
        icfa_factor=1.0,
        erv_unit_ids=[],
        catalog_origin=None,
        notes=None,
        custom_values=cast(
            dict[str, str | int | float | bool | None],
            {
                "number": "101",
                "name": "Living",
                "num_people": 0,
                "num_bedrooms": 0,
                "cf_color": "#abc",
            },
        ),
    )
    next_tables = body.tables.model_copy(update={"rooms": body.tables.rooms.model_copy(update={"rows": [row]})})

    with pytest.raises(ValidationError, match="color must be a 6-digit hex string"):
        ProjectDocumentV1.model_validate(body.model_copy(update={"tables": next_tables}).model_dump(mode="json"))
