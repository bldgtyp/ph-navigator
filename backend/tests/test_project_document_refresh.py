"""Drift-detection backend tests for TB-09.a refresh-from-catalog."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from database import transaction
from main import app
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def refresh_url(project_id: object, version_id: object, source: str = "draft") -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/refresh/window-types?source={source}"


def draft_window_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/window_types"


@pytest.fixture()
def clean_refresh_tables() -> Iterator[None]:
    sql = """
        TRUNCATE catalog_materials,
                 catalog_frame_type_versions, catalog_frame_types,
                 catalog_glazing_type_versions, catalog_glazing_types,
                 user_action_log, sessions, project_status_items,
                 project_version_drafts, project_versions, projects, users
        RESTART IDENTITY CASCADE
    """
    with transaction() as conn:
        conn.execute(sql)
    yield
    with transaction() as conn:
        conn.execute(sql)


def _create_frame(client: TestClient, name: str, u_value: float) -> dict[str, Any]:
    response = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={
            "name": name,
            "manufacturer": "Skyline",
            "brand": "Ridge",
            "version_label": "v1",
            "version_date": "2024-06-01",
            "width_mm": 100.0,
            "u_value_w_m2k": u_value,
            "psi_g_w_mk": 0.04,
            "psi_install_w_mk": 0.05,
            "color": None,
            "notes": None,
            "source_provenance": "datasheet",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_glazing(client: TestClient, name: str, u_value: float) -> dict[str, Any]:
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={
            "name": name,
            "manufacturer": "Vitro",
            "brand": "LowE",
            "version_label": "v1",
            "version_date": "2024-06-01",
            "u_value_w_m2k": u_value,
            "g_value": 0.5,
            "color": None,
            "notes": None,
            "source_provenance": "datasheet",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _frame_ref_from(frame: dict[str, Any], overrides: list[str] | None = None) -> dict[str, Any]:
    return {
        "name": frame["name"],
        "manufacturer": frame["manufacturer"],
        "brand": frame["brand"],
        "width_mm": frame["width_mm"],
        "u_value_w_m2k": frame["u_value_w_m2k"],
        "psi_g_w_mk": frame["psi_g_w_mk"],
        "psi_install_w_mk": frame["psi_install_w_mk"],
        "color": frame["color"],
        "notes": frame["notes"],
        "source_provenance": frame["source_provenance"],
        "catalog_origin": {
            "catalog_table": "frame_types",
            "catalog_record_id": frame["id"],
            "catalog_version_id": frame["current_version_id"],
            "catalog_schema_version": frame["catalog_schema_version"],
            "synced_at": "2026-05-14T12:00:00Z",
            "local_overrides": overrides or [],
        },
    }


def _glazing_ref_from(glazing: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": glazing["name"],
        "manufacturer": glazing["manufacturer"],
        "brand": glazing["brand"],
        "u_value_w_m2k": glazing["u_value_w_m2k"],
        "g_value": glazing["g_value"],
        "color": glazing["color"],
        "notes": glazing["notes"],
        "source_provenance": glazing["source_provenance"],
        "catalog_origin": {
            "catalog_table": "glazing_types",
            "catalog_record_id": glazing["id"],
            "catalog_version_id": glazing["current_version_id"],
            "catalog_schema_version": glazing["catalog_schema_version"],
            "synced_at": "2026-05-14T12:00:00Z",
            "local_overrides": [],
        },
    }


def _window_type_payload(frame_ref: dict[str, Any], glazing_ref: dict[str, Any]) -> dict[str, Any]:
    return {
        "window_types": [
            {
                "id": "win_A",
                "name": "Type A",
                "row_heights_mm": [1000.0],
                "column_widths_mm": [1000.0],
                "elements": [
                    {
                        "id": "winel_A1",
                        "row_span": [0, 0],
                        "column_span": [0, 0],
                        "frames": {
                            "top": frame_ref,
                            "right": None,
                            "bottom": None,
                            "left": None,
                        },
                        "glazing": glazing_ref,
                    }
                ],
            }
        ]
    }


def _seed_window_types(
    client: TestClient,
    project: dict[str, Any],
    frame: dict[str, Any],
    glazing: dict[str, Any],
    *,
    frame_overrides: list[str] | None = None,
) -> None:
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_window_types_url(project_id, version_id))
    assert initial.status_code == 200
    version_etag = initial.json()["version_etag"]
    payload = _window_type_payload(
        _frame_ref_from(frame, overrides=frame_overrides),
        _glazing_ref_from(glazing),
    )
    written = client.put(
        draft_window_types_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": version_etag},
        json=payload,
    )
    assert written.status_code == 200, written.text


def test_in_sync_when_pinned_version_matches_and_fields_equal(
    clean_refresh_tables: None,
) -> None:
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(client, project, frame, glazing)

    response = client.get(refresh_url(project["id"], project["active_version_id"]))
    assert response.status_code == 200
    slots = {(slot["slot"], slot["catalog_record_id"]): slot for slot in response.json()["slots"]}
    frame_slot = slots[("frame.top", frame["id"])]
    glazing_slot = slots[("glazing", glazing["id"])]
    assert frame_slot["state"] == "in_sync"
    assert glazing_slot["state"] == "in_sync"
    assert all(field["ref_value"] == field["catalog_value"] for field in frame_slot["fields"])


def test_drifted_when_field_differs(clean_refresh_tables: None) -> None:
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(client, project, frame, glazing)

    patch = client.patch(
        f"/api/v1/catalogs/frame-types/{frame['id']}",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.85},
    )
    assert patch.status_code == 200, patch.text

    response = client.get(refresh_url(project["id"], project["active_version_id"]))
    assert response.status_code == 200
    frame_slot = next(slot for slot in response.json()["slots"] if slot["slot"] == "frame.top")
    assert frame_slot["state"] == "drifted"
    by_key = {field["key"]: field for field in frame_slot["fields"]}
    assert by_key["u_value_w_m2k"]["ref_value"] == pytest.approx(0.95)
    assert by_key["u_value_w_m2k"]["catalog_value"] == pytest.approx(0.85)
    assert by_key["psi_g_w_mk"]["ref_value"] == by_key["psi_g_w_mk"]["catalog_value"]


def test_overridden_field_is_flagged_regardless_of_equality(
    clean_refresh_tables: None,
) -> None:
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(
        client,
        project,
        frame,
        glazing,
        frame_overrides=["u_value_w_m2k"],
    )

    response = client.get(refresh_url(project["id"], project["active_version_id"]))
    assert response.status_code == 200
    frame_slot = next(slot for slot in response.json()["slots"] if slot["slot"] == "frame.top")
    by_key = {field["key"]: field for field in frame_slot["fields"]}
    assert by_key["u_value_w_m2k"]["is_overridden"] is True
    assert by_key["psi_g_w_mk"]["is_overridden"] is False
    assert frame_slot["state"] == "in_sync"


def test_soft_deleted_catalog_row_is_source_deactivated(
    clean_refresh_tables: None,
) -> None:
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(client, project, frame, glazing)

    deactivated = client.delete(
        f"/api/v1/catalogs/frame-types/{frame['id']}",
        headers={"Origin": ORIGIN},
    )
    assert deactivated.status_code == 204

    response = client.get(refresh_url(project["id"], project["active_version_id"]))
    assert response.status_code == 200
    frame_slot = next(slot for slot in response.json()["slots"] if slot["slot"] == "frame.top")
    assert frame_slot["state"] == "source_deactivated"
    assert frame_slot["current_catalog_version_id"] is None
    assert all(field["catalog_value"] is None for field in frame_slot["fields"])


def test_hand_entered_refs_are_excluded(clean_refresh_tables: None) -> None:
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    # Hand-enter the glazing (catalog_origin = null) while keeping a catalog
    # frame so we can assert exactly one slot is reported.
    initial = client.get(draft_window_types_url(project_id, version_id))
    version_etag = initial.json()["version_etag"]
    hand_entered_glazing = {
        "name": "Hand entered",
        "manufacturer": None,
        "brand": None,
        "u_value_w_m2k": 0.7,
        "g_value": 0.4,
        "color": None,
        "notes": None,
        "source_provenance": None,
        "catalog_origin": None,
    }
    payload = _window_type_payload(_frame_ref_from(frame), hand_entered_glazing)
    written = client.put(
        draft_window_types_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": version_etag},
        json=payload,
    )
    assert written.status_code == 200, written.text

    response = client.get(refresh_url(project_id, version_id))
    assert response.status_code == 200
    slots = response.json()["slots"]
    assert len(slots) == 1
    assert slots[0]["slot"] == "frame.top"


def test_drifted_on_new_current_version_with_identical_fields(
    clean_refresh_tables: None,
) -> None:
    """Pinned `catalog_version_id` differs from current but every typed field
    still matches: the slot must still be reported as `drifted` so the user
    can see and acknowledge the version bump. Exercises the version-id branch
    of the drift state computation independently of field deltas."""
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(client, project, frame, glazing)

    # Fork a new current version with identical typed fields. There is no
    # "new version" API yet (data-model.md §7.3 in-place edit is the MVP
    # flow); the future new-version path will do the same INSERT + pointer
    # update this test performs directly.
    new_version_id = "framev_fork_v2_aaaa"
    with transaction() as conn:
        conn.execute(
            """
            INSERT INTO catalog_frame_type_versions
                (id, record_id, version_label, version_date,
                 manufacturer, brand, width_mm, u_value_w_m2k,
                 psi_g_w_mk, psi_install_w_mk, color, notes,
                 source_provenance, catalog_schema_version, created_by)
            SELECT %(new_id)s, record_id, 'v2', '2025-01-01',
                   manufacturer, brand, width_mm, u_value_w_m2k,
                   psi_g_w_mk, psi_install_w_mk, color, notes,
                   source_provenance, catalog_schema_version, created_by
            FROM catalog_frame_type_versions WHERE id = %(current)s
            """,
            {"new_id": new_version_id, "current": frame["current_version_id"]},
        )
        conn.execute(
            "UPDATE catalog_frame_types SET current_version_id = %(new)s WHERE id = %(record)s",
            {"new": new_version_id, "record": frame["id"]},
        )

    response = client.get(refresh_url(project["id"], project["active_version_id"]))
    assert response.status_code == 200
    frame_slot = next(slot for slot in response.json()["slots"] if slot["slot"] == "frame.top")
    assert frame_slot["state"] == "drifted"
    assert frame_slot["pinned_catalog_version_id"] == frame["current_version_id"]
    assert frame_slot["current_catalog_version_id"] == new_version_id
    assert all(field["ref_value"] == field["catalog_value"] for field in frame_slot["fields"])


def test_unauthenticated_and_viewer_reads_are_rejected(
    clean_refresh_tables: None,
) -> None:
    """V2 v1 has no logged-in non-owner state — editor access is "any signed-in
    user" per features/projects/access.py, so the only Viewer-equivalent path
    is unauthenticated. The route's `ProjectEditAccess` dependency rejects it
    with 401 before the report builder runs."""
    client = signed_in_client()
    frame = _create_frame(client, "SR-3", 0.95)
    glazing = _create_glazing(client, "Triple LowE", 0.6)
    project = create_project(client)
    _seed_window_types(client, project, frame, glazing)

    unauthenticated = TestClient(app)
    rejected = unauthenticated.get(refresh_url(project["id"], project["active_version_id"]))
    assert rejected.status_code in (401, 403)
