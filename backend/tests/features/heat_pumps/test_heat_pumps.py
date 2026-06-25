"""Heat Pumps Phase 0 backend tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.heat_pumps.models import HeatPumpOutdoorEquipRow
from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1
from tests.project_document_helpers import empty_required_tables, field_defs_fingerprint
from tests.status_field_helpers import (
    assert_status_field_def,
    assert_status_options,
    status_options_payload,
)
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


def draft_table_url(project_id: object, version_id: object, table_name: str) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/{table_name}"


def mutate_table_url(project_id: object, version_id: object, table_name: str) -> str:
    return f"{draft_table_url(project_id, version_id, table_name)}/custom-fields:mutate"


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


def add_field_mutation(*, table_key: str, fingerprint: str) -> dict[str, Any]:
    return {
        "kind": "addField",
        "table_key": table_key,
        "after": {
            "field_key": "cf_notes",
            "display_name": "Commissioning Notes",
            "field_type": CustomFieldType.short_text.value,
            "config": {},
            "description": None,
            "created_at": "2026-06-17T12:00:00Z",
            "created_by": None,
        },
        "expected_schema_fingerprint": fingerprint,
    }


def test_outdoor_equip_model_validates_enums_and_ranges() -> None:
    assert HeatPumpOutdoorEquipRow.model_validate(outdoor_equip()).model_number == "PUZ-A18NKA7"
    with pytest.raises(ValidationError, match="greater than 0"):
        HeatPumpOutdoorEquipRow.model_validate(outdoor_equip(heating_cop_47f=0))
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        HeatPumpOutdoorEquipRow.model_validate(outdoor_equip(heating_cap_kw_17f=-1))


def _heat_pump_document(tables: dict[str, Any]) -> ProjectDocumentV1:
    return ProjectDocumentV1.model_validate(
        {
            "schema_version": 1,
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


def test_document_defaults_heat_pump_arrays() -> None:
    document = _heat_pump_document(empty_required_tables())

    assert document.tables.equipment.heat_pumps.outdoor_equip.rows == []
    assert document.tables.equipment.heat_pumps.outdoor_equip.field_defs[0].field_key == "record_id"
    assert document.tables.equipment.heat_pumps.indoor_units.rows == []
    assert document.tables.equipment.heat_pumps.indoor_units.field_defs[0].field_key == "record_id"


def test_document_accepts_duplicate_heat_pump_tags() -> None:
    """Record-identity model: the heat-pump tag is an ordinary, non-unique
    field. Two rows may share a tag as long as their hidden ids differ."""
    tables = empty_required_tables()
    tables["equipment"]["heat_pumps"]["outdoor_equip"]["rows"] = [
        outdoor_equip(id=HPOE_1, tag="OE-1"),
        outdoor_equip(id=HPOE_2, tag="OE-1"),
    ]

    document = _heat_pump_document(tables)

    assert [row.id for row in document.tables.equipment.heat_pumps.outdoor_equip.rows] == [HPOE_1, HPOE_2]


def test_document_rejects_duplicate_heat_pump_row_id() -> None:
    """Heat-pump sub-tables keep their own row.id uniqueness guarantee."""
    tables = empty_required_tables()
    tables["equipment"]["heat_pumps"]["outdoor_equip"]["rows"] = [
        outdoor_equip(id=HPOE_1, tag="OE-1"),
        outdoor_equip(id=HPOE_1, tag="OE-2"),
    ]

    with pytest.raises(ValidationError, match="Duplicate heat-pump outdoor equipment id"):
        _heat_pump_document(tables)


def test_document_rejects_bad_heat_pump_fk() -> None:
    tables = empty_required_tables()
    tables["equipment"]["heat_pumps"]["outdoor_units"]["rows"] = [outdoor_unit()]

    with pytest.raises(ValidationError, match="Missing heat-pump outdoor equip"):
        _heat_pump_document(tables)


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


def test_heat_pumps_outdoor_equip_generic_contract_replace_and_schema_mutation(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_outdoor_equip"

    initial = client.get(draft_table_url(project_id, version_id, table_name))
    assert initial.status_code == 200, initial.text
    initial_body = initial.json()
    assert initial_body["outdoor_equip"] == []
    assert initial_body["field_defs"][0]["field_key"] == "record_id"
    assert set(initial_body["single_select_options"]) == {
        "heat_pumps.manufacturer",
        "heat_pumps.system_family",
        "heat_pumps.refrigerant",
        "heat_pumps_outdoor_equip.status",
    }

    schema_response = client.post(
        mutate_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match-Version": initial_body["version_etag"]},
        json=add_field_mutation(
            table_key=table_name,
            fingerprint=field_defs_fingerprint(initial_body["field_defs"]),
        ),
    )
    assert schema_response.status_code == 200, schema_response.text
    with_custom_field = schema_response.json()
    assert [field["field_key"] for field in with_custom_field["field_defs"] if field["origin"] == "custom"] == [
        "cf_notes"
    ]

    payload = {
        "field_defs": with_custom_field["field_defs"],
        "outdoor_equip": [
            {
                **outdoor_equip(),
                "custom_values": {"cf_notes": "Verify low-ambient cutout."},
            }
        ],
        "single_select_options": {
            "heat_pumps.manufacturer": [],
            "heat_pumps.system_family": [],
            "heat_pumps.refrigerant": [],
            "heat_pumps_outdoor_equip.status": status_options_payload(),
        },
    }
    updated = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match": with_custom_field["draft_etag"]},
        json=payload,
    )

    assert updated.status_code == 200, updated.text
    row = updated.json()["outdoor_equip"][0]
    assert row["custom_values"]["cf_notes"] == "Verify low-ambient cutout."


def test_heat_pumps_generic_contract_rejects_missing_fk(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, "heat_pumps_outdoor_units"))
    response = client.put(
        draft_table_url(project_id, version_id, "heat_pumps_outdoor_units"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={
            "field_defs": initial.json()["field_defs"],
            "outdoor_units": [outdoor_unit()],
            "single_select_options": {"heat_pumps_outdoor_units.status": status_options_payload()},
        },
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"
    assert "Missing heat-pump outdoor equip" in response.json()["details"]["errors"][0]


def test_heat_pumps_rejects_unknown_option_id(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    initial = client.get(heat_pumps_url(project["id"]))

    response = client.patch(
        heat_pumps_table_url(project["id"], "outdoor-equip"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_patch(outdoor_equip(manufacturer="opt_missing")),
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"
    assert "Missing heat-pump option heat_pumps.manufacturer" in response.json()["details"]["errors"][0]


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


def test_heat_pumps_outdoor_equip_exposes_and_persists_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_outdoor_equip"

    initial = client.get(draft_table_url(project_id, version_id, table_name))
    assert initial.status_code == 200, initial.text
    assert_status_field_def(initial.json()["field_defs"])
    assert_status_options(initial.json()["single_select_options"], "heat_pumps_outdoor_equip")

    payload = {
        "field_defs": initial.json()["field_defs"],
        "outdoor_equip": [{**outdoor_equip(), "custom_values": {"status": "opt_status_question"}}],
        "single_select_options": {
            "heat_pumps.manufacturer": [],
            "heat_pumps.system_family": [],
            "heat_pumps.refrigerant": [],
            "heat_pumps_outdoor_equip.status": status_options_payload(),
        },
    }
    updated = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert updated.status_code == 200, updated.text

    refetch = client.get(draft_table_url(project_id, version_id, table_name))
    assert refetch.json()["outdoor_equip"][0]["custom_values"]["status"] == "opt_status_question"
    assert_status_options(refetch.json()["single_select_options"], "heat_pumps_outdoor_equip")


def test_heat_pumps_indoor_equip_exposes_and_persists_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_indoor_equip"

    initial = client.get(draft_table_url(project_id, version_id, table_name))
    assert initial.status_code == 200, initial.text
    assert_status_field_def(initial.json()["field_defs"])
    assert_status_options(initial.json()["single_select_options"], "heat_pumps_indoor_equip")

    payload = {
        "field_defs": initial.json()["field_defs"],
        "indoor_equip": [{**indoor_equip(), "custom_values": {"status": "opt_status_na"}}],
        "single_select_options": {
            "heat_pumps.manufacturer": [],
            "heat_pumps.model_type": [],
            "heat_pumps.install_type": [],
            "heat_pumps_indoor_equip.status": status_options_payload(),
        },
    }
    updated = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert updated.status_code == 200, updated.text

    refetch = client.get(draft_table_url(project_id, version_id, table_name))
    assert refetch.json()["indoor_equip"][0]["custom_values"]["status"] == "opt_status_na"


def test_heat_pumps_outdoor_equip_rejects_unknown_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_outdoor_equip"

    initial = client.get(draft_table_url(project_id, version_id, table_name))
    payload = {
        "field_defs": initial.json()["field_defs"],
        "outdoor_equip": [{**outdoor_equip(), "custom_values": {"status": "opt_status_bogus"}}],
        "single_select_options": {
            "heat_pumps.manufacturer": [],
            "heat_pumps.system_family": [],
            "heat_pumps.refrigerant": [],
            "heat_pumps_outdoor_equip.status": status_options_payload(),
        },
    }
    response = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert response.status_code == 422


def _seed_outdoor_equip(client: Any, project_id: object, version_id: object) -> None:
    """PUT a single outdoor-equip row so outdoor-unit FKs resolve."""
    initial = client.get(draft_table_url(project_id, version_id, "heat_pumps_outdoor_equip"))
    put = client.put(
        draft_table_url(project_id, version_id, "heat_pumps_outdoor_equip"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={
            "field_defs": initial.json()["field_defs"],
            "outdoor_equip": [outdoor_equip()],
            "single_select_options": {
                "heat_pumps.manufacturer": [],
                "heat_pumps.system_family": [],
                "heat_pumps.refrigerant": [],
                "heat_pumps_outdoor_equip.status": status_options_payload(),
            },
        },
    )
    assert put.status_code == 200, put.text


def test_heat_pumps_outdoor_units_exposes_and_persists_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_outdoor_units"

    initial = client.get(draft_table_url(project_id, version_id, table_name))
    assert initial.status_code == 200, initial.text
    assert_status_field_def(initial.json()["field_defs"])
    assert_status_options(initial.json()["single_select_options"], "heat_pumps_outdoor_units")

    _seed_outdoor_equip(client, project_id, version_id)

    current = client.get(draft_table_url(project_id, version_id, table_name))
    updated = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match": current.json()["draft_etag"]},
        json={
            "field_defs": current.json()["field_defs"],
            "outdoor_units": [{**outdoor_unit(), "custom_values": {"status": "opt_status_question"}}],
            "single_select_options": {"heat_pumps_outdoor_units.status": status_options_payload()},
        },
    )
    assert updated.status_code == 200, updated.text

    refetch = client.get(draft_table_url(project_id, version_id, table_name))
    assert refetch.json()["outdoor_units"][0]["custom_values"]["status"] == "opt_status_question"
    assert_status_options(refetch.json()["single_select_options"], "heat_pumps_outdoor_units")


def test_heat_pumps_outdoor_units_rejects_unknown_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    table_name = "heat_pumps_outdoor_units"

    _seed_outdoor_equip(client, project_id, version_id)

    current = client.get(draft_table_url(project_id, version_id, table_name))
    response = client.put(
        draft_table_url(project_id, version_id, table_name),
        headers={"Origin": ORIGIN, "If-Match": current.json()["draft_etag"]},
        json={
            "field_defs": current.json()["field_defs"],
            "outdoor_units": [{**outdoor_unit(), "custom_values": {"status": "opt_status_bogus"}}],
            "single_select_options": {"heat_pumps_outdoor_units.status": status_options_payload()},
        },
    )
    assert response.status_code == 422


def test_heat_pumps_indoor_units_exposes_status(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, "heat_pumps_indoor_units"))
    assert initial.status_code == 200, initial.text
    assert_status_field_def(initial.json()["field_defs"])
    assert_status_options(initial.json()["single_select_options"], "heat_pumps_indoor_units")
