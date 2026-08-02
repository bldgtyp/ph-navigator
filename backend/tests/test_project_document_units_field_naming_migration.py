"""Focused v8→v9 units metadata and field-key migration tests."""

from __future__ import annotations

from typing import Any, cast

import pytest

from features.project_document.migrations import upgrade_project_document
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest

HPIE_ID = "hpie_01HX0000000000000000000001"
PUMP_ID = "pmp_1"


def _v8_body() -> dict[str, Any]:
    body = empty_project_document(
        CreateProjectRequest(name="Units Migration", bt_number="BT-V9", cert_programs=[])
    ).model_dump(mode="json")
    body["schema_version"] = 8
    equipment = cast(dict[str, Any], cast(dict[str, Any], body["tables"])["equipment"])
    heat_pumps = cast(dict[str, Any], equipment["heat_pumps"])

    outdoor = cast(dict[str, Any], heat_pumps["outdoor_equip"])
    for field in cast(list[dict[str, Any]], outdoor["field_defs"]):
        if field["field_key"] in {"heating_cap_kw_17f", "heating_cap_kw_47f", "cooling_cap_kw_95f"}:
            field["config"] = {}

    indoor = cast(dict[str, Any], heat_pumps["indoor_equip"])
    old_key_by_current = {
        "cooling_cap_kw": "cooling_btuh",
        "heating_cap_kw_47f": "heating_btuh_47f",
        "heating_cap_kw_17f": "heating_btuh_17f",
    }
    for field in cast(list[dict[str, Any]], indoor["field_defs"]):
        current_key = field["field_key"]
        if current_key not in old_key_by_current:
            continue
        field["field_key"] = old_key_by_current[current_key]
        field["config"] = {}
        field["description"] = None
    indoor["rows"] = [
        {
            "id": HPIE_ID,
            "tag": "AH-1",
            "cooling_btuh": 8.79,
            "heating_btuh_47f": 9.96,
            "heating_btuh_17f": 24000,
            "custom_values": {"name": "Indoor unit"},
        }
    ]

    pumps = cast(dict[str, Any], equipment["pumps"])
    flow_field = next(
        field for field in cast(list[dict[str, Any]], pumps["field_defs"]) if field["field_key"] == "flow_l_min"
    )
    flow_field["field_key"] = "flow_gpm"
    pumps["rows"] = [{"id": PUMP_ID, "custom_values": {"flow_gpm": 56.8}}]
    return body


def test_v8_to_v9_renames_unit_fields_and_converts_only_legacy_btuh_value() -> None:
    result = upgrade_project_document(_v8_body())

    assert result.applied_steps == ("_upgrade_v8_to_v9",)
    assert result.document.schema_version == 9
    indoor = result.document.tables.equipment.heat_pumps.indoor_equip
    row = indoor.rows[0]
    assert row.cooling_cap_kw == 8.79
    assert row.heating_cap_kw_47f == 9.96
    assert row.heating_cap_kw_17f == pytest.approx(24000 / 3412.141633)
    assert row.custom_values["name"] == "Indoor unit"

    indoor_fields = {field.field_key: field for field in indoor.field_defs}
    assert not {"cooling_btuh", "heating_btuh_47f", "heating_btuh_17f"}.intersection(indoor_fields)
    for field_key in {"cooling_cap_kw", "heating_cap_kw_47f", "heating_cap_kw_17f"}:
        assert indoor_fields[field_key].config["units"] == {
            "mode": "fixed",
            "unit_type": "power",
            "si_unit": "kw",
            "ip_unit": "kbtu_h",
            "precision_si": 2,
            "precision_ip": 1,
        }

    outdoor_fields = {
        field.field_key: field for field in result.document.tables.equipment.heat_pumps.outdoor_equip.field_defs
    }
    outdoor_units = cast(dict[str, Any], outdoor_fields["heating_cap_kw_17f"].config["units"])
    assert outdoor_units["si_unit"] == "kw"

    pumps = result.document.tables.equipment.pumps
    pump_fields = {field.field_key: field for field in pumps.field_defs}
    assert "flow_gpm" not in pump_fields
    pump_units = cast(dict[str, Any], pump_fields["flow_l_min"].config["units"])
    assert pump_units["si_unit"] == "l_min"
    assert pumps.rows[0].custom_values["flow_l_min"] == 56.8
    assert "flow_gpm" not in pumps.rows[0].custom_values


def test_v9_units_field_migration_is_idempotent() -> None:
    migrated = upgrade_project_document(_v8_body()).document.model_dump(mode="json")

    second = upgrade_project_document(migrated)

    assert second.applied_steps == ()
    assert second.upgraded_raw_body == migrated
