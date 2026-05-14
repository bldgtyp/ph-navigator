"""Window Types document shape and table contract tests for TB-08.b."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from features.project_document.document import (
    ProjectDocumentV1,
    WindowTypeEntry,
)
from features.project_document.tables import get_table_contract
from features.project_document.tables.window_types import (
    WINDOW_TYPES_TABLE_NAME,
    WindowTypesSliceReplaceRequest,
)
from main import app
from tests.test_project_document import (
    ORIGIN,
    create_project,
    signed_in_client,
)


def saved_window_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/window_types"


def draft_window_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/window_types"


def download_window_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/download/tables/window_types"


def diff_url(project_id: object, from_version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/diff?from={from_version_id}&to=draft"


def make_window_type(
    *,
    id: str = "win_A",
    name: str = "Type A",
    rows: list[float] | None = None,
    cols: list[float] | None = None,
    elements: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "name": name,
        "row_heights_mm": rows or [1000.0],
        "column_widths_mm": cols or [1000.0],
        "elements": elements
        or [
            {
                "id": "winel_A1",
                "row_span": [0, 0],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        ],
    }


def base_document_body(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "project": {
            "name": project["name"],
            "bt_number": project["bt_number"],
            "cert_programs": [],
        },
        "tables": {"window_types": []},
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
        },
    }


def test_window_type_entry_requires_at_least_one_element_and_dimension() -> None:
    base = make_window_type()

    no_rows = dict(base, row_heights_mm=[])
    with pytest.raises(ValidationError):
        WindowTypeEntry.model_validate(no_rows)

    no_cols = dict(base, column_widths_mm=[])
    with pytest.raises(ValidationError):
        WindowTypeEntry.model_validate(no_cols)

    no_elements = dict(base, elements=[])
    with pytest.raises(ValidationError):
        WindowTypeEntry.model_validate(no_elements)

    zero_dim = dict(base, row_heights_mm=[0.0])
    with pytest.raises(ValidationError):
        WindowTypeEntry.model_validate(zero_dim)


def test_window_element_span_must_be_in_bounds_and_ordered() -> None:
    out_of_bounds = make_window_type(
        rows=[1000.0],
        cols=[1000.0],
        elements=[
            {
                "id": "winel_oob",
                "row_span": [0, 1],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        ],
    )
    with pytest.raises(ValidationError, match="row_span out of bounds"):
        WindowTypeEntry.model_validate(out_of_bounds)

    reversed_span = make_window_type(
        rows=[1000.0, 1000.0],
        cols=[1000.0],
        elements=[
            {
                "id": "winel_rev",
                "row_span": [1, 0],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        ],
    )
    with pytest.raises(ValidationError, match="span start must be <= end"):
        WindowTypeEntry.model_validate(reversed_span)


def test_document_rejects_duplicate_window_type_names_trim_case_insensitive() -> None:
    body = {
        "schema_version": 1,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            "window_types": [
                make_window_type(id="win_A", name="Type A"),
                make_window_type(id="win_B", name="  type a  "),
            ]
        },
        "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
    }
    with pytest.raises(ValidationError, match="Duplicate window type name"):
        ProjectDocumentV1.model_validate(body)


def test_catalog_origin_requires_all_fields_and_defaults_local_overrides() -> None:
    from features.project_document.document import FrameRef

    def origin(**overrides: Any) -> dict[str, Any]:
        base: dict[str, Any] = {
            "catalog_table": "frame_types",
            "catalog_record_id": "rec0123456789ABCD",
            "catalog_version_id": "framev_abc123",
            "catalog_schema_version": 1,
            "synced_at": "2026-05-14T12:00:00Z",
        }
        base.update(overrides)
        return base

    frame = FrameRef.model_validate({"name": "SR-3", "catalog_origin": origin()})
    assert frame.catalog_origin is not None
    assert frame.catalog_origin.local_overrides == []

    missing_synced_at = origin()
    missing_synced_at.pop("synced_at")
    with pytest.raises(ValidationError):
        FrameRef.model_validate({"name": "SR-3", "catalog_origin": missing_synced_at})

    bad_record_id = origin(catalog_record_id="not-a-rec-id")
    with pytest.raises(ValidationError):
        FrameRef.model_validate({"name": "SR-3", "catalog_origin": bad_record_id})


def test_frame_ref_rejects_non_frame_catalog_origin() -> None:
    from features.project_document.document import FrameRef, GlazingRef

    wrong_table = {
        "catalog_table": "glazing_types",
        "catalog_record_id": "rec0123456789ABCD",
        "catalog_version_id": "glazingv_abc123",
        "catalog_schema_version": 1,
        "synced_at": "2026-05-14T12:00:00Z",
    }
    with pytest.raises(ValidationError, match="catalog_table must be 'frame_types'"):
        FrameRef.model_validate({"name": "SR-3", "catalog_origin": wrong_table})

    mismatched_version = {
        "catalog_table": "frame_types",
        "catalog_record_id": "rec0123456789ABCD",
        "catalog_version_id": "matv_abc123",
        "catalog_schema_version": 1,
        "synced_at": "2026-05-14T12:00:00Z",
    }
    with pytest.raises(ValidationError, match="must start with 'framev_'"):
        FrameRef.model_validate({"name": "SR-3", "catalog_origin": mismatched_version})

    with pytest.raises(ValidationError, match="catalog_table must be 'glazing_types'"):
        GlazingRef.model_validate(
            {
                "name": "Triple-Pane",
                "catalog_origin": {
                    "catalog_table": "frame_types",
                    "catalog_record_id": "rec0123456789ABCD",
                    "catalog_version_id": "framev_abc123",
                    "catalog_schema_version": 1,
                    "synced_at": "2026-05-14T12:00:00Z",
                },
            }
        )


def test_window_types_contract_replace_read_diff_download(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_window_types_url(project_id, version_id))
    assert initial.status_code == 200
    initial_body = initial.json()
    assert initial_body["source"] == "version"
    assert initial_body["window_types"] == []

    payload = {
        "window_types": [
            make_window_type(
                id="win_A",
                name="Type A",
                elements=[
                    {
                        "id": "winel_A1",
                        "row_span": [0, 0],
                        "column_span": [0, 0],
                        "frames": {
                            "top": {
                                "name": "Skyline Ridge SR-3",
                                "manufacturer": "Skyline",
                                "brand": "Ridge",
                                "width_mm": 100.0,
                                "u_value_w_m2k": 0.85,
                                "psi_g_w_mk": 0.04,
                                "psi_install_w_mk": None,
                                "argb_color": None,
                                "notes": None,
                                "source_provenance": None,
                                "catalog_origin": {
                                    "catalog_table": "frame_types",
                                    "catalog_record_id": "rec0123456789ABCD",
                                    "catalog_version_id": "framev_abc123",
                                    "catalog_schema_version": 1,
                                    "synced_at": "2026-05-14T12:00:00Z",
                                    "local_overrides": [],
                                },
                            },
                            "right": None,
                            "bottom": None,
                            "left": None,
                        },
                        "glazing": None,
                    }
                ],
            )
        ]
    }

    written = client.put(
        draft_window_types_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial_body["version_etag"]},
        json=payload,
    )
    assert written.status_code == 200, written.text
    written_body = written.json()
    assert written_body["source"] == "draft"
    assert written_body["draft_etag"]
    assert written_body["window_types"][0]["name"] == "Type A"
    frame_origin = written_body["window_types"][0]["elements"][0]["frames"]["top"]["catalog_origin"]
    assert frame_origin["catalog_record_id"] == "rec0123456789ABCD"
    assert frame_origin["local_overrides"] == []

    reloaded = client.get(draft_window_types_url(project_id, version_id))
    assert reloaded.status_code == 200
    assert reloaded.json()["window_types"][0]["name"] == "Type A"

    diff = client.get(diff_url(project_id, version_id))
    assert diff.status_code == 200
    diff_tables = {summary["table"]: summary for summary in diff.json()["tables"]}
    assert WINDOW_TYPES_TABLE_NAME in diff_tables
    assert diff_tables[WINDOW_TYPES_TABLE_NAME]["change_count"] >= 1
    assert any("win_A" in path for path in diff_tables[WINDOW_TYPES_TABLE_NAME]["changed_paths"])

    download = client.get(download_window_types_url(project_id, version_id))
    assert download.status_code == 200
    assert download.json() == {"window_types": []}


def test_window_types_schema_endpoint_returns_window_type_entry_schema() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/schemas/window-type/v1.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["title"] == "WindowTypeEntry"
    assert schema["properties"]["id"]["pattern"] == r"^win_[A-Za-z0-9_-]+$"


def test_window_types_contract_round_trip_via_registry() -> None:
    contract = get_table_contract(WINDOW_TYPES_TABLE_NAME)
    assert contract.schema_slug == "window-type"
    assert contract.schema_model is WindowTypeEntry
    assert contract.replace_request_model is WindowTypesSliceReplaceRequest
