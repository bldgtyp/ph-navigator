"""Hot Water Heaters document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import HotWaterHeaterRow, ProjectDocumentV1
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_hot_water_heaters_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_hot_water_heaters_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/hot_water_heaters"


def hot_water_heater_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_hot_water_heaters_table()["field_defs"],
        "hot_water_heaters": [
            {
                "id": "hwh_1",
                "heater_type": "opt_hwh_heat_pump_annual_cop",
                "phase": 1,
                "url": "https://example.com/hwh.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "HWH-1",
                    "name": "DHW heater",
                    "quantity": 1,
                    "model": "ST-80",
                    "manufacturer": "Acme",
                    "size_l": 302.8,
                    "temperature_c": 60,
                    "amps": 1.2,
                    "volts": 120,
                    "power_factor": 0.8,
                    "watts": 120,
                    "uef": 0.92,
                },
            }
        ],
        "single_select_options": {
            "hot_water_heaters.type": [
                {"id": "opt_hwh_electric", "label": "1-Electric", "color": "#ef4444", "order": 0},
                {"id": "opt_hwh_boiler_gas_oil", "label": "2-Boiler (Gas/Oil)", "color": "#f97316", "order": 1},
                {"id": "opt_hwh_boiler_wood", "label": "3-Boiler (Wood)", "color": "#92400e", "order": 2},
                {"id": "opt_hwh_district", "label": "4-District", "color": "#6366f1", "order": 3},
                {
                    "id": "opt_hwh_heat_pump_annual_cop",
                    "label": "5-Heat Pump (Annual COP)",
                    "color": "#10b981",
                    "order": 4,
                },
                {
                    "id": "opt_hwh_heat_pump_monthly_cop",
                    "label": "6-Heat Pump (Monthly COP)",
                    "color": "#14b8a6",
                    "order": 5,
                },
                {
                    "id": "opt_hwh_heat_pump_inside",
                    "label": "7-Heat Pump (Inside)",
                    "color": "#0ea5e9",
                    "order": 6,
                },
            ]
        },
    }


def test_hot_water_heater_row_validates_phase_and_url() -> None:
    base = hot_water_heater_payload()["hot_water_heaters"][0]
    assert HotWaterHeaterRow.model_validate(base).custom_values["record_id"] == "HWH-1"
    with pytest.raises(ValidationError, match="phase must be 1 or 3"):
        HotWaterHeaterRow.model_validate({**base, "phase": 2})
    with pytest.raises(ValidationError, match="url must start"):
        HotWaterHeaterRow.model_validate({**base, "url": "ftp://example.com/hwh.pdf"})


def test_document_rejects_missing_hot_water_heater_type_option() -> None:
    first = hot_water_heater_payload()["hot_water_heaters"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 8,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {
                **tables["equipment"],
                "hot_water_heaters": empty_hot_water_heaters_table(rows=[first]),
            },
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
            "fans.type": [],
            "hot_water_heaters.type": [],
        },
    }

    with pytest.raises(ValidationError, match="Missing hot water heater type option"):
        ProjectDocumentV1.model_validate(body)


def test_first_hot_water_heaters_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_hot_water_heaters_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"

    updated = client.put(
        draft_hot_water_heaters_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=hot_water_heater_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["hot_water_heaters"][0]["custom_values"]["record_id"] == "HWH-1"


def test_legacy_equipment_hot_water_heaters_contract_preserves_table_envelope() -> None:
    first = hot_water_heater_payload()["hot_water_heaters"][0]
    tables = empty_required_tables()
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": 8,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                **tables,
                "equipment": {
                    **tables["equipment"],
                    "hot_water_heaters": empty_hot_water_heaters_table(rows=[first]),
                },
            },
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
                "pumps.device_type": [],
                "ventilators.inside_outside": [],
                "fans.type": [],
                "hot_water_heaters.type": [
                    {
                        "id": "opt_hwh_heat_pump_annual_cop",
                        "label": "5-Heat Pump (Annual COP)",
                        "color": "#10b981",
                        "order": 0,
                    }
                ],
            },
        }
    )
    contract = get_table_contract("equipment_hot_water_heaters")

    next_body = contract.apply_replace(
        body,
        contract.parse_replace_payload({"rows": [{**first, "notes": "Updated through heater attachment table."}]}),
    )

    assert next_body.tables.equipment.hot_water_heaters.field_defs[0].display_name == "Tag"
    assert next_body.tables.equipment.hot_water_heaters.rows[0].notes == "Updated through heater attachment table."
