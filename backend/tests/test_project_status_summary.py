from __future__ import annotations

from copy import deepcopy
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from features.project_document import store as document_store
from features.project_document.models import ProjectDocumentView
from features.project_document.status_summary import (
    STATUS_SUMMARY_TABLES,
    StatusSummaryCounts,
    StatusSummaryRecord,
)
from features.project_document.tables._status_field import STATUS_TABLE_NAMES
from features.projects.access import ProjectAccess
from main import app
from tests.test_project_document import ORIGIN, create_project, create_rooms_draft, signed_in_client
from tests.test_project_document_pumps import draft_pumps_url, pump_payload


def _summary_url(project_id: object, version_id: object, source: str) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/{source}/status-summary"


def _put_pump_rows(
    client: TestClient,
    project_id: object,
    version_id: object,
    rows: list[dict[str, object]],
) -> None:
    table_url = draft_pumps_url(project_id, version_id)
    current = client.get(table_url)
    payload = pump_payload()
    payload["pumps"] = rows
    response = client.put(
        table_url,
        headers={"Origin": ORIGIN, "If-Match-Version": current.json()["version_etag"]},
        json=payload,
    )
    assert response.status_code == 200, response.text


def _pump_row(index: int, *, status: str, notes: str | None = None) -> dict[str, object]:
    row = deepcopy(pump_payload()["pumps"][0])
    row["id"] = f"pmp_{index}"
    row["notes"] = notes
    row["custom_values"] = {
        **row["custom_values"],
        "name": f"Pump {index}",
        "record_id": f"P-{index}",
        "status": status,
    }
    return row


def test_status_summary_registry_covers_shared_status_tables_in_product_order() -> None:
    assert {table.table_name for table in STATUS_SUMMARY_TABLES} == set(STATUS_TABLE_NAMES)
    assert [table.table_name for table in STATUS_SUMMARY_TABLES] == [
        "ventilators",
        "heat_pumps_outdoor_equip",
        "heat_pumps_indoor_equip",
        "heat_pumps_outdoor_units",
        "heat_pumps_indoor_units",
        "pumps",
        "fans",
        "hot_water_heaters",
        "hot_water_tanks",
        "electric_heaters",
        "appliances",
        "thermal_bridges",
    ]


def test_status_summary_registry_records_all_destination_families() -> None:
    by_name = {table.table_name: table for table in STATUS_SUMMARY_TABLES}

    assert by_name["pumps"].destination_kind == "equipment_tab"
    assert by_name["pumps"].destination_key == "pumps"
    assert by_name["heat_pumps_indoor_units"].destination_kind == "heat_pump_leaf"
    assert by_name["heat_pumps_indoor_units"].destination_key == "units-indoor"
    assert by_name["thermal_bridges"].destination_kind == "thermal_bridges"
    assert by_name["thermal_bridges"].destination_key is None


def test_status_summary_counts_include_unknown_without_treating_it_as_needed() -> None:
    counts = StatusSummaryCounts(needed=2, question=1, complete=3, na=4, unknown=5)

    assert counts.total == 15
    assert counts.needed == 2
    assert counts.unknown == 5


def test_status_summary_record_rejects_an_unregistered_status() -> None:
    with pytest.raises(ValidationError, match="status"):
        StatusSummaryRecord(
            id="row_1",
            display_name="Row",
            status="blocked",  # ty: ignore[invalid-argument-type]
            notes=None,
        )


def test_draft_status_summary_route_returns_draft_contract(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    response = client.get(_summary_url(project_id, version_id, "draft"))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "draft"
    assert len(body["groups"]) == 9
    assert sum(len(group["leaves"]) for group in body["groups"]) == 12


def test_summary_projects_status_name_notes_and_group_counts(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    _put_pump_rows(
        client,
        project_id,
        version_id,
        [
            _pump_row(1, status="opt_status_needed", notes="  Confirm control sequence.  "),
            _pump_row(2, status="opt_status_question"),
            _pump_row(3, status="opt_status_complete"),
            _pump_row(4, status="opt_status_na"),
        ],
    )

    response = client.get(_summary_url(project_id, version_id, "draft"))

    assert response.status_code == 200
    body = response.json()
    pumps = next(group for group in body["groups"] if group["key"] == "pumps")
    assert pumps["counts"] == {"needed": 1, "question": 1, "complete": 1, "na": 1, "unknown": 0}
    assert pumps["leaves"][0]["records"][0] == {
        "id": "pmp_1",
        "display_name": "Pump 1",
        "status": "needed",
        "notes": "Confirm control sequence.",
    }


def test_anonymous_summary_reads_saved_version_not_editor_draft(clean_document_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)
    project_id = project["id"]
    version_id = project["active_version_id"]
    _put_pump_rows(editor, project_id, version_id, [_pump_row(1, status="opt_status_needed")])

    viewer = TestClient(app)
    saved = viewer.get(_summary_url(project_id, version_id, "document"))
    draft = viewer.get(_summary_url(project_id, version_id, "draft"))

    assert saved.status_code == 200
    assert saved.json()["source"] == "version"
    assert saved.json()["counts"]["needed"] == 0
    assert draft.status_code == 401


def test_draft_summary_loads_the_project_document_once(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)
    original = document_store.get_current_document_view
    loads: list[UUID] = []

    def counted(version: UUID, access: ProjectAccess) -> ProjectDocumentView:
        loads.append(version)
        return original(version, access)

    monkeypatch.setattr(document_store, "get_current_document_view", counted)

    response = client.get(_summary_url(project_id, version_id, "draft"))

    assert response.status_code == 200
    assert loads == [UUID(str(version_id))]


def test_large_summary_stays_under_compact_payload_target(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    rows = [
        _pump_row(index, status="opt_status_needed", notes="Coordinate selections.")
        for index in range(1, 501)
    ]
    _put_pump_rows(client, project_id, version_id, rows)

    response = client.get(_summary_url(project_id, version_id, "draft"))

    assert response.status_code == 200
    assert response.json()["counts"]["needed"] == 500
    assert len(response.content) < 100_000
