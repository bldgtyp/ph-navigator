"""Pumps document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.document import ProjectDocumentV1, PumpRow
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def pump_payload() -> dict[str, Any]:
    return {
        "pumps": [
            {
                "id": "pmp_1",
                "device_type": "opt_circ",
                "use": "DHW recirc",
                "tag": "P-1",
                "manufacturer": "Taco",
                "model": "0015e3",
                "volts": 120,
                "phase": 1,
                "horse_power": None,
                "wattage": 45,
                "flow_gpm": 4,
                "runtime_khr_yr": 2.5,
                "notes": None,
                "link": "https://example.com/pump.pdf",
                "datasheet_asset_ids": [],
            }
        ],
        "single_select_options": {
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}]
        },
    }


def test_pump_row_validates_phase_and_link() -> None:
    base = pump_payload()["pumps"][0]
    assert PumpRow.model_validate(base).tag == "P-1"
    with pytest.raises(ValidationError, match="phase must be 1 or 3"):
        PumpRow.model_validate({**base, "phase": 2})
    with pytest.raises(ValidationError, match="link must start"):
        PumpRow.model_validate({**base, "link": "ftp://example.com/pump.pdf"})


def test_document_rejects_duplicate_pump_tags_case_insensitive() -> None:
    first = pump_payload()["pumps"][0]
    body = {
        "schema_version": 2,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {"equipment": {"pumps": [first, {**first, "id": "pmp_2", "tag": " p-1 "}]}},
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
        },
    }
    with pytest.raises(ValidationError, match="Duplicate pump tag"):
        ProjectDocumentV1.model_validate(body)


def test_first_pumps_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"

    updated = client.put(
        draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=pump_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["pumps"][0]["tag"] == "P-1"
