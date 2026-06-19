"""Hot Water Tanks document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException
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
                "tank_type": "opt_hwt_dhw_heating",
                "inside_outside": "opt_hwt_inside",
                "url": "https://example.com/hwt.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "HWT-1",
                    "name": "DHW storage tank",
                    "quantity": 1,
                    "manufacturer": "Acme",
                    "model": "ST-80",
                    "size_l": 302.8,
                    "heat_loss_rate_w_k": 1.8,
                },
            }
        ],
        "single_select_options": {
            "hot_water_tanks.type": [
                {"id": "opt_hwt_dhw_heating", "label": "1-DHW and Heating", "color": "#0ea5e9", "order": 0},
                {"id": "opt_hwt_dhw_only", "label": "2-DHW only", "color": "#14b8a6", "order": 1},
            ],
            "hot_water_tanks.inside_outside": [
                {"id": "opt_hwt_inside", "label": "Inside", "color": "#0ea5e9", "order": 0},
                {"id": "opt_hwt_outside", "label": "Outside", "color": "#f97316", "order": 1},
            ],
        },
    }


def test_hot_water_tank_row_validates_url() -> None:
    base = hot_water_tank_payload()["hot_water_tanks"][0]
    assert HotWaterTankRow.model_validate(base).custom_values["record_id"] == "HWT-1"
    with pytest.raises(ValidationError, match="url must start"):
        HotWaterTankRow.model_validate({**base, "url": "ftp://example.com/hwt.pdf"})


def test_document_rejects_missing_hot_water_tank_type_option() -> None:
    first = hot_water_tank_payload()["hot_water_tanks"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 11,
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
            "hot_water_heaters.type": [],
            "hot_water_tanks.type": [],
            "hot_water_tanks.inside_outside": [],
            "electric_heaters.type": [],
            "appliances.type": [],
            "appliances.energy_star": [],
            "thermal_bridges.type": [],
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


def test_legacy_equipment_hot_water_tanks_contract_is_not_registered() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_table_contract("equipment_hot_water_tanks")
    assert exc_info.value.status_code == 404
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error_code"] == "document_table_not_found"
