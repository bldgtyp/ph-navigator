from __future__ import annotations

import pytest
from pydantic import ValidationError

from features.project_document.status_summary import (
    STATUS_SUMMARY_TABLES,
    StatusSummaryCounts,
    StatusSummaryRecord,
)
from features.project_document.tables._status_field import STATUS_TABLE_NAMES
from tests.test_project_document import create_project, signed_in_client


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

    response = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/draft/status-summary"
    )

    assert response.status_code == 200
    assert response.json()["source"] == "draft"
