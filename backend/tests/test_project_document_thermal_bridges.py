"""Thermal Bridges document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import ProjectDocumentV1, ThermalBridgeRow
from tests.project_document_helpers import empty_required_tables, empty_thermal_bridges_table
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_thermal_bridges_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/thermal_bridges"


def thermal_bridge_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_thermal_bridges_table()["field_defs"],
        "thermal_bridges": [
            {
                "id": "tb_1",
                "thermal_bridge_type": "opt_tb_ambient",
                "pdf_report_asset_ids": [],
                "notes": "Basis of design.",
                "custom_values": {
                    "record_id": "TB-1",
                    "name": "Roof parapet",
                    "sheet_name": "A-501",
                    "drawing_number": "4/A-501",
                    "psi_value_w_mk": 0.094,
                    "frsi_value": 0.83,
                },
            }
        ],
        "single_select_options": {
            "thermal_bridges.type": [
                {"id": "opt_tb_ambient", "label": "15-Ambient", "color": "#0ea5e9", "order": 0},
                {"id": "opt_tb_perimeter", "label": "16-Perimeter", "color": "#f97316", "order": 1},
                {
                    "id": "opt_tb_below_grade",
                    "label": "17-Below-Grade",
                    "color": "#64748b",
                    "order": 2,
                },
            ]
        },
    }


def test_thermal_bridge_row_strips_notes() -> None:
    base = thermal_bridge_payload()["thermal_bridges"][0]
    row = ThermalBridgeRow.model_validate({**base, "notes": "  keep  "})
    assert row.notes == "keep"


def test_document_rejects_missing_thermal_bridge_type_option() -> None:
    first = thermal_bridge_payload()["thermal_bridges"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 6,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "thermal_bridges": empty_thermal_bridges_table(rows=[first]),
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
            "fans.type": [],
            "thermal_bridges.type": [],
        },
    }

    with pytest.raises(ValidationError, match="Missing thermal bridge type option"):
        ProjectDocumentV1.model_validate(body)


def test_first_thermal_bridges_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_thermal_bridges_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"

    updated = client.put(
        draft_thermal_bridges_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=thermal_bridge_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["thermal_bridges"][0]["custom_values"]["record_id"] == "TB-1"
