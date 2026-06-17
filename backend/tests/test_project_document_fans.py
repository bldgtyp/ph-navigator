"""Fans document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from features.project_document.document import FanRow, ProjectDocumentV1
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_fans_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_fans_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/fans"


def fan_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_fans_table()["field_defs"],
        "fans": [
            {
                "id": "fan_1",
                "fan_type": "opt_fan_kitchen_hood",
                "phase": 1,
                "url": "https://example.com/fan.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "F-1",
                    "name": "Kitchen hood exhaust",
                    "quantity": 1,
                    "model": "KH-100",
                    "manufacturer": "Acme",
                    "annual_runtime_min_yr": 12000,
                    "airflow_m3h": 425.0,
                    "amps": 1.2,
                    "volts": 120,
                    "power_factor": 0.8,
                    "watts": 120,
                },
            }
        ],
        "single_select_options": {
            "fans.type": [
                {"id": "opt_fan_dryer", "label": "1-Dryer", "color": "#f97316", "order": 0},
                {"id": "opt_fan_kitchen_hood", "label": "2-Kitchen Hood", "color": "#0ea5e9", "order": 1},
                {"id": "opt_fan_user_defined", "label": "3-User Defined", "color": "#8b5cf6", "order": 2},
            ]
        },
    }


def test_fan_row_validates_phase_and_url() -> None:
    base = fan_payload()["fans"][0]
    assert FanRow.model_validate(base).custom_values["record_id"] == "F-1"
    with pytest.raises(ValidationError, match="phase must be 1 or 3"):
        FanRow.model_validate({**base, "phase": 2})
    with pytest.raises(ValidationError, match="url must start"):
        FanRow.model_validate({**base, "url": "ftp://example.com/fan.pdf"})


def test_document_rejects_missing_fan_type_option() -> None:
    first = fan_payload()["fans"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 10,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {**tables["equipment"], "fans": empty_fans_table(rows=[first])},
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
            "fans.type": [],
        },
    }

    with pytest.raises(ValidationError, match="Missing fan type option"):
        ProjectDocumentV1.model_validate(body)


def test_first_fans_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_fans_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"

    updated = client.put(
        draft_fans_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=fan_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["fans"][0]["custom_values"]["record_id"] == "F-1"


def test_legacy_equipment_fans_contract_is_not_registered() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_table_contract("equipment_fans")
    assert exc_info.value.status_code == 404
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error_code"] == "document_table_not_found"
