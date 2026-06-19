"""Electric Heaters document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from features.project_document.document import (
    CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
    ElectricHeaterRow,
    ProjectDocumentV1,
)
from features.project_document.tables.registry import get_table_contract
from tests.project_document_helpers import empty_electric_heaters_table, empty_required_tables
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_electric_heaters_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/electric_heaters"


def electric_heater_payload(datasheet_asset_ids: list[str] | None = None) -> dict[str, Any]:
    return {
        "field_defs": empty_electric_heaters_table()["field_defs"],
        "electric_heaters": [
            {
                "id": "heatr_1",
                "url": "https://example.com/heater.pdf",
                "notes": "Basis of design.",
                "datasheet_asset_ids": datasheet_asset_ids or [],
                "custom_values": {
                    "record_id": "EH-1",
                    "name": "Bath electric heater",
                    "model": "EH-1000",
                    "manufacturer": "Acme",
                    "watt": 1000,
                },
            }
        ],
        "single_select_options": {},
    }


def test_electric_heater_row_validates_url() -> None:
    base = electric_heater_payload(["asset_01HXABCDEF0123456789ABCD"])["electric_heaters"][0]
    row = ElectricHeaterRow.model_validate(base)
    assert row.custom_values["record_id"] == "EH-1"
    assert row.datasheet_asset_ids == ["asset_01HXABCDEF0123456789ABCD"]
    with pytest.raises(ValidationError, match="url must start"):
        ElectricHeaterRow.model_validate({**base, "url": "ftp://example.com/heater.pdf"})


def test_document_rejects_duplicate_electric_heater_id() -> None:
    first = electric_heater_payload()["electric_heaters"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {
                **tables["equipment"],
                "electric_heaters": empty_electric_heaters_table(rows=[first, first]),
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

    with pytest.raises(ValidationError, match="Duplicate electric heater id"):
        ProjectDocumentV1.model_validate(body)


def test_first_electric_heaters_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_electric_heaters_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"
    assert initial.json()["field_defs"][0]["display_name"] == "Tag"
    assert any(field["field_key"] == "datasheet_asset_ids" for field in initial.json()["field_defs"])

    updated = client.put(
        draft_electric_heaters_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=electric_heater_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["electric_heaters"][0]["custom_values"]["record_id"] == "EH-1"
    assert body["electric_heaters"][0]["datasheet_asset_ids"] == []


def test_legacy_equipment_electric_heaters_contract_is_not_registered() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_table_contract("equipment_electric_heaters")
    assert exc_info.value.status_code == 404
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error_code"] == "document_table_not_found"
