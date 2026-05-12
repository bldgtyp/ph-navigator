"""Project-document draft contract tests for TB-04."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.project_document.document import ProjectDocumentV1
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_document_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )
    yield
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def signed_in_client() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


def create_project(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "West Stockbridge House",
            "bt_number": "2426",
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201
    return response.json()


def saved_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/rooms"


def draft_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"


def room_payload() -> dict[str, Any]:
    return {
        "rooms": [
            {
                "id": "rm_living",
                "number": "101",
                "name": "Living Room",
                "floor_level": "opt_ground",
                "building_zone": "opt_residential",
                "num_people": 2,
                "num_bedrooms": 0,
                "icfa_factor": 1.0,
                "erv_unit_ids": [],
                "catalog_origin": None,
                "notes": None,
            }
        ],
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0}],
            "rooms.building_zone": [{"id": "opt_residential", "label": "Residential", "color": "#10b981", "order": 0}],
        },
    }


def test_empty_project_document_has_rooms_and_option_lists() -> None:
    body = empty_project_document(
        CreateProjectRequest(
            name="West Stockbridge House",
            bt_number="2426",
            cert_programs=["phi"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )

    assert body == ProjectDocumentV1.model_validate(body.model_dump(mode="json"))
    assert body.tables.rooms == []
    assert body.single_select_options["rooms.floor_level"] == []
    assert body.single_select_options["rooms.building_zone"] == []


def test_first_rooms_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_rooms_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"

    updated = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=room_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["rooms"][0]["number"] == "101"

    with connection() as conn:
        draft = conn.execute(
            """
            SELECT body
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        version = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()

    assert draft is not None
    assert draft["body"]["tables"]["rooms"][0]["name"] == "Living Room"
    assert version is not None
    assert version["body"]["tables"]["rooms"] == []

    reloaded = client.get(draft_rooms_url(project_id, version_id))
    assert reloaded.status_code == 200
    assert reloaded.json()["source"] == "draft"
    assert reloaded.json()["rooms"][0]["name"] == "Living Room"


def test_rooms_replace_requires_current_draft_etag(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_rooms_url(project_id, version_id))
    created = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=room_payload(),
    )
    assert created.status_code == 200

    stale = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": "stale"},
        json={**room_payload(), "rooms": []},
    )

    assert stale.status_code == 409
    assert stale.json()["error_code"] == "draft_etag_mismatch"
    reloaded = client.get(draft_rooms_url(project_id, version_id))
    assert reloaded.json()["rooms"][0]["id"] == "rm_living"


def test_rooms_validation_rejects_duplicate_options_and_missing_option(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_rooms_url(project_id, version_id))

    invalid = room_payload()
    invalid["single_select_options"] = {
        "rooms.floor_level": [
            {"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0},
            {"id": "opt_ground_2", "label": " ground ", "color": "#10b981", "order": 1},
        ],
        "rooms.building_zone": [],
    }

    response = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=invalid,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"

    invalid = room_payload()
    del invalid["single_select_options"]["rooms.building_zone"]
    response = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=invalid,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "validation_error"

    invalid = room_payload()
    invalid["rooms"][0]["floor_level"] = "opt_missing"
    response = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=invalid,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"


def test_public_viewer_can_read_rooms_but_not_write(clean_document_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)
    project_id = project["id"]
    version_id = project["active_version_id"]

    public_client = TestClient(app)
    read = public_client.get(saved_rooms_url(project_id, version_id))
    assert read.status_code == 200
    assert read.json()["source"] == "version"

    write = public_client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": read.json()["version_etag"]},
        json=room_payload(),
    )
    assert write.status_code == 401
    assert write.json()["error_code"] == "not_authenticated"
