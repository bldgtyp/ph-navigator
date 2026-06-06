"""Appliances document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import ApplianceRow, ProjectDocumentV1
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_appliances_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_appliances_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/appliances"


def appliance_options() -> dict[str, list[dict[str, object]]]:
    return {
        "appliances.type": [
            {"id": "opt_appl_dishwasher", "label": "1-Dishwasher", "color": "#0ea5e9", "order": 0},
            {"id": "opt_appl_clothes_washer", "label": "2-Clothes Washer", "color": "#14b8a6", "order": 1},
            {"id": "opt_appl_clothes_dryer", "label": "3-Clothes Dryer", "color": "#f97316", "order": 2},
            {"id": "opt_appl_refrigerator", "label": "4-Refrigerator", "color": "#3b82f6", "order": 3},
            {"id": "opt_appl_freezer", "label": "5-Freezer", "color": "#6366f1", "order": 4},
            {"id": "opt_appl_fridge_freezer", "label": "6-Fridge-Freezer", "color": "#8b5cf6", "order": 5},
            {"id": "opt_appl_oven", "label": "7-Oven", "color": "#ef4444", "order": 6},
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
                "appliance_type": "opt_appl_refrigerator",
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


def test_appliance_row_validates_url() -> None:
    base = appliance_payload()["appliances"][0]
    assert ApplianceRow.model_validate(base).custom_values["record_id"] == "A-1"
    with pytest.raises(ValidationError, match="url must start"):
        ApplianceRow.model_validate({**base, "url": "ftp://example.com/appliance.pdf"})


def test_document_rejects_missing_appliance_type_option() -> None:
    first = appliance_payload()["appliances"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 4,
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
            "hot_water_tanks.type": [],
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
            "schema_version": 4,
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
                "hot_water_tanks.type": [],
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
