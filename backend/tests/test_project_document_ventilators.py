"""Ventilators document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from features.project_document.document import ProjectDocumentV1, VentilatorRow
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_required_tables, empty_ventilators_table
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_ventilators_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/ventilators"


def ventilator_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_ventilators_table()["field_defs"],
        "ventilators": [
            {
                "id": "vent_1",
                "inside_outside": "opt_vent_inside",
                "url": "https://example.com/erv.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "ERV-1",
                    "name": "Apartment ERV",
                    "airflow_rate_m3h": 425.0,
                    "model": "Q350",
                    "manufacturer": "Zehnder",
                    "heat_recovery_percent": 84,
                    "moisture_recovery_percent": 70,
                    "electrical_efficiency_wh_m3": 0.42,
                    "filter_merv_rating": 13,
                },
            }
        ],
        "single_select_options": {
            "ventilators.inside_outside": [
                {"id": "opt_vent_inside", "label": "Inside", "color": "#3b82f6", "order": 0},
                {"id": "opt_vent_outside", "label": "Outside", "color": "#10b981", "order": 1},
            ]
        },
    }


def test_ventilator_row_validates_url() -> None:
    base = ventilator_payload()["ventilators"][0]
    row = VentilatorRow.model_validate(base)
    assert row.custom_values["record_id"] == "ERV-1"
    assert row.datasheet_asset_ids == []
    with pytest.raises(ValidationError, match="url must start"):
        VentilatorRow.model_validate({**base, "url": "ftp://example.com/erv.pdf"})


def test_document_rejects_missing_inside_outside_option() -> None:
    first = ventilator_payload()["ventilators"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 11,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {**tables["equipment"], "ervs": empty_ventilators_table(rows=[first])},
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [],
            "ventilators.inside_outside": [],
        },
    }

    with pytest.raises(ValidationError, match="Missing ventilator inside/outside option"):
        ProjectDocumentV1.model_validate(body)


def test_first_ventilators_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_ventilators_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"
    assert any(field["field_key"] == "datasheet_asset_ids" for field in initial.json()["field_defs"])

    updated = client.put(
        draft_ventilators_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=ventilator_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["ventilators"][0]["custom_values"]["record_id"] == "ERV-1"
    assert body["ventilators"][0]["datasheet_asset_ids"] == []


def test_legacy_equipment_ervs_contract_is_not_registered() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_table_contract("equipment_ervs")
    assert exc_info.value.status_code == 404
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error_code"] == "document_table_not_found"
