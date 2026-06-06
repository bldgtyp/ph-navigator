"""Hot Water Tanks document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import HotWaterTankRow, ProjectDocumentV1
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_hot_water_tanks_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_hot_water_tanks_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/hot_water_tanks"


def hot_water_tank_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_hot_water_tanks_table()["field_defs"],
        "hot_water_tanks": [
            {
                "id": "hwt_1",
                "tank_type": "opt_hwt_user_defined",
                "phase": 1,
                "url": "https://example.com/hwt.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "HWT-1",
                    "name": "DHW storage tank",
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
            "hot_water_tanks.type": [
                {"id": "opt_hwt_dryer", "label": "1-Dryer", "color": "#f97316", "order": 0},
                {"id": "opt_hwt_kitchen_hood", "label": "2-Kitchen Hood", "color": "#0ea5e9", "order": 1},
                {"id": "opt_hwt_user_defined", "label": "3-User Defined", "color": "#8b5cf6", "order": 2},
            ]
        },
    }


def test_hot_water_tank_row_validates_phase_and_url() -> None:
    base = hot_water_tank_payload()["hot_water_tanks"][0]
    assert HotWaterTankRow.model_validate(base).custom_values["record_id"] == "HWT-1"
    with pytest.raises(ValidationError, match="phase must be 1 or 3"):
        HotWaterTankRow.model_validate({**base, "phase": 2})
    with pytest.raises(ValidationError, match="url must start"):
        HotWaterTankRow.model_validate({**base, "url": "ftp://example.com/hwt.pdf"})


def test_document_rejects_missing_hot_water_tank_type_option() -> None:
    first = hot_water_tank_payload()["hot_water_tanks"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 4,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {
                **tables["equipment"],
                "hot_water_tanks": empty_hot_water_tanks_table(rows=[first]),
            },
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
            "fans.type": [],
            "hot_water_tanks.type": [],
        },
    }

    with pytest.raises(ValidationError, match="Missing hot water tank type option"):
        ProjectDocumentV1.model_validate(body)


def test_first_hot_water_tanks_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_hot_water_tanks_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"

    updated = client.put(
        draft_hot_water_tanks_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=hot_water_tank_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["hot_water_tanks"][0]["custom_values"]["record_id"] == "HWT-1"


def test_legacy_equipment_hot_water_tanks_contract_preserves_table_envelope() -> None:
    first = hot_water_tank_payload()["hot_water_tanks"][0]
    tables = empty_required_tables()
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": 4,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                **tables,
                "equipment": {
                    **tables["equipment"],
                    "hot_water_tanks": empty_hot_water_tanks_table(rows=[first]),
                },
            },
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
                "pumps.device_type": [],
                "ventilators.inside_outside": [],
                "fans.type": [],
                "hot_water_tanks.type": [
                    {"id": "opt_hwt_user_defined", "label": "3-User Defined", "color": "#8b5cf6", "order": 0}
                ],
            },
        }
    )
    contract = get_table_contract("equipment_hot_water_tanks")

    next_body = contract.apply_replace(
        body,
        contract.parse_replace_payload({"rows": [{**first, "notes": "Updated through legacy attachment table."}]}),
    )

    assert next_body.tables.equipment.hot_water_tanks.field_defs[0].display_name == "Tag"
    assert next_body.tables.equipment.hot_water_tanks.rows[0].notes == "Updated through legacy attachment table."
