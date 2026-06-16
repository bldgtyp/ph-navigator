"""Heat Pumps Phase 0 backend tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.heat_pumps.models import HeatPumpOutdoorEquipRow
from features.project_document.document import ProjectDocumentV1
from tests.project_document_helpers import empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client

HPOE_1 = "hpoe_01HX0000000000000000000001"
HPOE_2 = "hpoe_01HX0000000000000000000002"
HPIE_1 = "hpie_01HX0000000000000000000001"
HPOU_1 = "hpou_01HX0000000000000000000001"
HPIU_1 = "hpiu_01HX0000000000000000000001"


def heat_pumps_url(project_id: object) -> str:
    return f"/api/v1/projects/{project_id}/equipment/heat-pumps"


def heat_pumps_table_url(project_id: object, table: str, *, dry_run: bool = False) -> str:
    suffix = "?dry-run=true" if dry_run else ""
    return f"{heat_pumps_url(project_id)}/{table}{suffix}"


def outdoor_equip(**overrides: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": HPOE_1,
        "tag": "OE-1",
        "manufacturer": None,
        "model_number": "PUZ-A18NKA7",
        "paired_indoor_equip_id": None,
        "system_family": None,
        "refrigerant": None,
        "heating_cap_kw_17f": 3.52,
        "heating_cap_kw_47f": 5.28,
        "heating_data_type": "COPs",
        "heating_cop_17f": 2.1,
        "heating_cop_47f": 3.4,
        "hspf": None,
        "cooling_cap_kw_95f": 4.98,
        "cooling_data_type": "EER2/SEER2",
        "eer": 11.2,
        "seer": 18.0,
        "ieer": None,
        "datasheet_asset_ids": [],
        "notes": None,
        "catalog_origin": None,
    }
    row.update(overrides)
    return row


def indoor_equip(**overrides: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": HPIE_1,
        "tag": "IE-1",
        "manufacturer": None,
        "model_type": None,
        "model_number": "PLA-A12EA8",
        "install_type": None,
        "nominal_tons": 1.0,
        "fan_speed_cfm": 425.0,
        "cooling_btuh": 3.52,
        "heating_btuh_47f": 4.1,
        "heating_btuh_17f": 10000.0,
        "heating_cop": 3.1,
        "seer": None,
        "eer": None,
        "hspf": None,
        "datasheet_asset_ids": [],
        "notes": None,
        "catalog_origin": None,
    }
    row.update(overrides)
    return row


def outdoor_unit(**overrides: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": HPOU_1,
        "tag": "HP-1",
        "outdoor_equip_id": HPOE_1,
        "datasheet_asset_ids": [],
        "notes": None,
    }
    row.update(overrides)
    return row


def indoor_unit(**overrides: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": HPIU_1,
        "tag": "AHU-1",
        "indoor_equip_id": HPIE_1,
        "outdoor_unit_id": HPOU_1,
        "linked_erv_unit_id": None,
        "served_room_ids": [],
        "datasheet_asset_ids": [],
        "notes": None,
    }
    row.update(overrides)
    return row


def add_patch(value: dict[str, Any]) -> dict[str, Any]:
    return {"op": "add", "path": "/-", "value": value}


def remove_patch(row_id: str) -> dict[str, Any]:
    return {"op": "remove", "path": f"/{row_id}"}


def test_outdoor_equip_model_validates_enums_and_ranges() -> None:
    assert HeatPumpOutdoorEquipRow.model_validate(outdoor_equip()).model_number == "PUZ-A18NKA7"
    with pytest.raises(ValidationError, match="greater than 0"):
        HeatPumpOutdoorEquipRow.model_validate(outdoor_equip(heating_cop_47f=0))
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        HeatPumpOutdoorEquipRow.model_validate(outdoor_equip(heating_cap_kw_17f=-1))


def test_document_defaults_heat_pump_arrays() -> None:
    tables = empty_required_tables()
    document = ProjectDocumentV1.model_validate(
        {
            "schema_version": 6,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": tables,
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
                "pumps.device_type": [],
                "ventilators.inside_outside": [],
            },
        }
    )

    assert document.tables.equipment.heat_pumps.outdoor_equip == []
    assert document.tables.equipment.heat_pumps.indoor_units == []


def test_document_rejects_bad_heat_pump_fk() -> None:
    tables = empty_required_tables()
    tables["equipment"]["heat_pumps"]["outdoor_units"] = [outdoor_unit()]

    with pytest.raises(ValidationError, match="Missing heat-pump outdoor equip"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": 6,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": tables,
                "single_select_options": {
                    "rooms.floor_level": [],
                    "rooms.building_zone": [],
                    "pumps.device_type": [],
                    "ventilators.inside_outside": [],
                },
            }
        )


def test_heat_pumps_get_and_patch_add_round_trip(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)

    initial = client.get(heat_pumps_url(project["id"]))
    assert initial.status_code == 200
    assert initial.json()["outdoor_equip"] == []

    added = client.patch(
        heat_pumps_table_url(project["id"], "outdoor-equip"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_patch(outdoor_equip()),
    )

    assert added.status_code == 200
    assert added.json()["source"] == "draft"
    assert added.json()["outdoor_equip"][0]["model_number"] == "PUZ-A18NKA7"
    refetched = client.get(heat_pumps_url(project["id"]))
    assert refetched.json()["outdoor_equip"][0]["id"] == HPOE_1


def test_heat_pumps_rejects_missing_fk(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    initial = client.get(heat_pumps_url(project["id"]))

    response = client.patch(
        heat_pumps_table_url(project["id"], "outdoor-units"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_patch(outdoor_unit()),
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "heat_pump_validation_error"
    assert response.json()["details"]["field"] == "outdoor_equip_id"


def test_heat_pumps_blocks_delete_referenced_outdoor_equip(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    etag = client.get(heat_pumps_url(project["id"])).json()["version_etag"]
    for table, row in [("outdoor-equip", outdoor_equip()), ("outdoor-units", outdoor_unit())]:
        headers = (
            {"Origin": ORIGIN, "If-Match-Version": etag}
            if table == "outdoor-equip"
            else {"Origin": ORIGIN, "If-Match": etag}
        )
        response = client.patch(
            heat_pumps_table_url(project["id"], table),
            headers=headers,
            json=add_patch(row),
        )
        assert response.status_code == 200
        etag = response.json()["draft_etag"]

    blocked = client.patch(
        heat_pumps_table_url(project["id"], "outdoor-equip"),
        headers={"Origin": ORIGIN, "If-Match": etag},
        json=remove_patch(HPOE_1),
    )

    assert blocked.status_code == 409
    assert blocked.json()["error_code"] == "heat_pump_delete_blocked"
    assert blocked.json()["details"]["referenced_by"][0]["tag"] == "HP-1"


def test_heat_pumps_dry_run_previews_and_confirm_cascades(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    etag = client.get(heat_pumps_url(project["id"])).json()["version_etag"]
    rows = [
        ("indoor-equip", indoor_equip()),
        ("outdoor-equip", outdoor_equip(paired_indoor_equip_id=HPIE_1)),
    ]
    for table, row in rows:
        headers = (
            {"Origin": ORIGIN, "If-Match-Version": etag}
            if table == "indoor-equip"
            else {"Origin": ORIGIN, "If-Match": etag}
        )
        response = client.patch(
            heat_pumps_table_url(project["id"], table),
            headers=headers,
            json=add_patch(row),
        )
        assert response.status_code == 200
        etag = response.json()["draft_etag"]

    preview = client.patch(
        heat_pumps_table_url(project["id"], "indoor-equip", dry_run=True),
        headers={"Origin": ORIGIN, "If-Match": etag},
        json=remove_patch(HPIE_1),
    )
    assert preview.status_code == 200
    assert preview.json()["cascade_preview"]["affected"][0]["field"] == "paired_indoor_equip_id"
    assert preview.json()["outdoor_equip"][0]["paired_indoor_equip_id"] == HPIE_1

    confirmed = client.patch(
        heat_pumps_table_url(project["id"], "indoor-equip"),
        headers={"Origin": ORIGIN, "If-Match": etag},
        json=remove_patch(HPIE_1),
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["indoor_equip"] == []
    assert confirmed.json()["outdoor_equip"][0]["paired_indoor_equip_id"] is None
