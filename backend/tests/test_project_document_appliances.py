"""Appliances document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import ApplianceRow, ProjectDocumentV1
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_appliances_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_appliances_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/appliances"


def appliance_options() -> dict[str, list[dict[str, object]]]:
    return {
        "appliances.type": [
            {"id": "opt_appl_dishwasher", "label": "1-dishwasher", "color": "#0ea5e9", "order": 0},
            {"id": "opt_appl_clothes_washer", "label": "2-clothes_washer", "color": "#14b8a6", "order": 1},
            {"id": "opt_appl_clothes_dryer", "label": "3-clothes_dryer", "color": "#f97316", "order": 2},
            {"id": "opt_appl_fridge", "label": "4-fridge", "color": "#3b82f6", "order": 3},
            {"id": "opt_appl_freezer", "label": "5-freezer", "color": "#6366f1", "order": 4},
            {"id": "opt_appl_fridge_freezer", "label": "6-fridge_freezer", "color": "#8b5cf6", "order": 5},
            {"id": "opt_appl_cooking", "label": "7-cooking", "color": "#ef4444", "order": 6},
            {"id": "opt_appl_phius_mel", "label": "13-PHIUS_MEL", "color": "#f59e0b", "order": 7},
            {
                "id": "opt_appl_phius_lighting_int",
                "label": "14-PHIUS_Lighting_Int",
                "color": "#84cc16",
                "order": 8,
            },
            {
                "id": "opt_appl_phius_lighting_ext",
                "label": "15-PHIUS_Lighting_Ext",
                "color": "#22c55e",
                "order": 9,
            },
            {
                "id": "opt_appl_phius_lighting_garage",
                "label": "16-PHIUS_Lighting_Garage",
                "color": "#10b981",
                "order": 10,
            },
            {
                "id": "opt_appl_custom_electric_per_year",
                "label": "11-Custom_Electric_per_Year",
                "color": "#06b6d4",
                "order": 11,
            },
            {
                "id": "opt_appl_custom_electric_lighting_per_year",
                "label": "17-Custom_Electric_Lighting_per_Year",
                "color": "#6366f1",
                "order": 12,
            },
            {
                "id": "opt_appl_custom_electric_mel_per_use",
                "label": "18-Custom_Electric_MEL_per_Use",
                "color": "#8b5cf6",
                "order": 13,
            },
            {
                "id": "opt_appl_commercial_dishwasher",
                "label": "21-Commercial_Dishwasher",
                "color": "#a855f7",
                "order": 14,
            },
            {
                "id": "opt_appl_commercial_refrigerator",
                "label": "22-Commercial_Refrigerator",
                "color": "#d946ef",
                "order": 15,
            },
            {
                "id": "opt_appl_commercial_cooking",
                "label": "23-Commercial_Cooking",
                "color": "#ec4899",
                "order": 16,
            },
            {
                "id": "opt_appl_commercial_custom",
                "label": "24-Commercial_Custom",
                "color": "#64748b",
                "order": 17,
            },
        ],
        "appliances.energy_star": [
            {"id": "opt_appl_energy_star_yes", "label": "Yes", "color": "#10b981", "order": 0},
            {"id": "opt_appl_energy_star_no", "label": "No", "color": "#64748b", "order": 1},
        ],
    }


def appliance_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_appliances_table()["field_defs"],
        "appliances": [
            {
                "id": "appl_1",
                "appliance_type": "opt_appl_fridge",
                "energy_star": "opt_appl_energy_star_yes",
                "url": "https://example.com/appliance.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "A-1",
                    "name": "Kitchen refrigerator",
                    "quantity": 1,
                    "model": "RF-36",
                    "manufacturer": "Acme",
                    "capacity_m3": 0.62,
                    "cef": 12.1,
                    "imef": 2.76,
                    "mef": 2.2,
                    "annual_energy_kwh": 420,
                },
            }
        ],
        "single_select_options": appliance_options(),
    }


def test_annual_energy_field_has_fixed_kwh_kbtu_units() -> None:
    annual_energy = next(field for field in APPLIANCES_BUILT_IN_FIELD_DEFS if field.field_key == "annual_energy_kwh")

    assert annual_energy.config["units"] == {
        "mode": "fixed",
        "unit_type": "energy",
        "si_unit": "kwh",
        "ip_unit": "kbtu",
        "precision_si": 0,
        "precision_ip": 0,
    }


def test_appliance_row_validates_url() -> None:
    base = appliance_payload()["appliances"][0]
    assert ApplianceRow.model_validate(base).custom_values["record_id"] == "A-1"
    with pytest.raises(ValidationError, match="url must start"):
        ApplianceRow.model_validate({**base, "url": "ftp://example.com/appliance.pdf"})


def test_document_rejects_missing_appliance_type_option() -> None:
    first = appliance_payload()["appliances"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 6,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {
                **tables["equipment"],
                "appliances": empty_appliances_table(rows=[first]),
            },
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
            "fans.type": [],
            "hot_water_heaters.type": [],
            "appliances.type": [],
            "appliances.energy_star": appliance_options()["appliances.energy_star"],
        },
    }

    with pytest.raises(ValidationError, match="Missing appliance type option"):
        ProjectDocumentV1.model_validate(body)


def test_first_appliances_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_appliances_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"

    updated = client.put(
        draft_appliances_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=appliance_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["appliances"][0]["custom_values"]["record_id"] == "A-1"


def test_legacy_equipment_appliances_contract_preserves_table_envelope() -> None:
    first = appliance_payload()["appliances"][0]
    tables = empty_required_tables()
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": 6,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                **tables,
                "equipment": {
                    **tables["equipment"],
                    "appliances": empty_appliances_table(rows=[first]),
                },
            },
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
                "pumps.device_type": [],
                "ventilators.inside_outside": [],
                "fans.type": [],
                "hot_water_heaters.type": [],
                **appliance_options(),
            },
        }
    )
    contract = get_table_contract("equipment_appliances")

    next_body = contract.apply_replace(
        body,
        contract.parse_replace_payload({"rows": [{**first, "notes": "Updated through legacy attachment table."}]}),
    )

    assert next_body.tables.equipment.appliances.field_defs[0].display_name == "Tag"
    assert next_body.tables.equipment.appliances.rows[0].notes == "Updated through legacy attachment table."
