"""Plan-14 P1.6 end-to-end acceptance for the developer-seeded
Rooms custom field.

These tests pin the Phase 1 exit criteria from plan-13 §5: a custom
`short_text` field seeded through the dev path renders in the Rooms
slice, accepts cell writes (via whole-table replace), persists through
Save / Save As, and respects the version lock.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import psycopg.types.json as psycopg_json
from fastapi.testclient import TestClient

from database import transaction
from features.auth.service import create_or_update_user
from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1
from features.project_document.tables._dev_seed import seed_rooms_custom_field
from main import app

ORIGIN = "http://localhost:5173"


def _signed_in_client() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


def _create_project(client: TestClient) -> dict[str, Any]:
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


def _saved_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/rooms"


def _draft_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"


def _save_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save"


def _save_as_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save-as"


def _version_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}"


def _seed_custom_field_directly(version_id: object, display_name: str) -> str:
    """Mutate the saved version body in-place via the dev seed helper.

    Phase 1 has no HTTP / MCP write tool for schema mutations, so this
    fixture path writes the seeded `custom_fields` straight into the
    project_versions JSONB body. Returns the generated `cf_*` id.
    """
    with transaction() as conn:
        row = conn.execute(
            "SELECT body FROM project_versions WHERE id = %(version_id)s",
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        body = ProjectDocumentV1.model_validate(row["body"])
        next_body, custom_field = seed_rooms_custom_field(
            body,
            display_name=display_name,
            field_type=CustomFieldType.short_text,
            created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        )
        conn.execute(
            "UPDATE project_versions SET body = %(body)s WHERE id = %(version_id)s",
            {
                "body": psycopg_json.Jsonb(next_body.model_dump(mode="json")),
                "version_id": version_id,
            },
        )
    return custom_field.id


def _build_room_payload(custom_field_id: str, custom_value: str | None = "needs paint") -> dict[str, Any]:
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
                "custom": {custom_field_id: custom_value} if custom_value is not None else {},
            }
        ],
        "custom_fields": [
            {
                "id": custom_field_id,
                "field_key": None,
                "display_name": "Paint",
                "field_type": "short_text",
                "config": {},
                "description": None,
                "created_at": "2026-05-24T12:00:00Z",
                "created_by": None,
            }
        ],
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0}],
            "rooms.building_zone": [
                {"id": "opt_residential", "label": "Residential", "color": "#10b981", "order": 0},
            ],
        },
    }


def test_seed_and_read_returns_custom_field_on_rooms_slice(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    cf_id = _seed_custom_field_directly(version_id, "Paint")

    response = client.get(_saved_rooms_url(project_id, version_id))
    assert response.status_code == 200
    body = response.json()
    assert len(body["custom_fields"]) == 1
    custom = body["custom_fields"][0]
    assert custom["id"] == cf_id
    assert custom["id"].startswith("cf_")
    assert custom["field_type"] == "short_text"


def test_write_and_read_custom_value_round_trips(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    cf_id = _seed_custom_field_directly(version_id, "Paint")

    draft = client.get(_draft_rooms_url(project_id, version_id))
    assert draft.status_code == 200
    payload = _build_room_payload(cf_id, "needs paint")
    write = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": draft.json()["version_etag"]},
        json=payload,
    )
    assert write.status_code == 200

    reloaded = client.get(_draft_rooms_url(project_id, version_id))
    assert reloaded.json()["rooms"][0]["custom"] == {cf_id: "needs paint"}


def test_orphan_custom_value_is_rejected(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    cf_id = _seed_custom_field_directly(version_id, "Paint")

    draft = client.get(_draft_rooms_url(project_id, version_id))
    payload = _build_room_payload(cf_id, "needs paint")
    # Strip the custom_fields entry but keep the row.custom reference —
    # the document validator must reject this as `invalid_project_document`.
    payload["custom_fields"] = []
    response = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": draft.json()["version_etag"]},
        json=payload,
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"


def test_save_flushes_custom_field_to_version(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    cf_id = _seed_custom_field_directly(version_id, "Paint")

    draft = client.get(_draft_rooms_url(project_id, version_id))
    payload = _build_room_payload(cf_id, "needs paint")
    write = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": draft.json()["version_etag"]},
        json=payload,
    )
    assert write.status_code == 200

    save = client.post(
        _save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft.json()["version_etag"]},
    )
    assert save.status_code == 200

    saved = client.get(_saved_rooms_url(project_id, version_id))
    assert saved.status_code == 200
    body = saved.json()
    assert len(body["custom_fields"]) == 1
    assert body["custom_fields"][0]["id"] == cf_id
    assert body["rooms"][0]["custom"] == {cf_id: "needs paint"}


def test_save_as_copies_custom_field_and_values_to_new_version(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    cf_id = _seed_custom_field_directly(version_id, "Paint")

    draft = client.get(_draft_rooms_url(project_id, version_id))
    payload = _build_room_payload(cf_id, "needs paint")
    client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": draft.json()["version_etag"]},
        json=payload,
    )

    saved_as = client.post(
        _save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Round 1", "kind": "submitted", "locked": False},
    )
    assert saved_as.status_code == 200
    new_version_id = saved_as.json()["version"]["id"]

    new_saved = client.get(_saved_rooms_url(project_id, new_version_id))
    assert new_saved.status_code == 200
    new_body = new_saved.json()
    assert new_body["custom_fields"][0]["id"] == cf_id
    assert new_body["rooms"][0]["custom"] == {cf_id: "needs paint"}


def test_locked_version_blocks_draft_write_to_custom_value(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    cf_id = _seed_custom_field_directly(version_id, "Paint")

    locked = client.patch(
        _version_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200

    draft = client.get(_draft_rooms_url(project_id, version_id))
    payload = _build_room_payload(cf_id, "needs paint")
    response = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": draft.json()["version_etag"]},
        json=payload,
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "version_locked"

    # Save As must still copy the seeded custom field across.
    save_as = client.post(
        _save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Working Copy", "kind": "working", "locked": False},
    )
    assert save_as.status_code == 200
    copied_id = save_as.json()["version"]["id"]
    copied = client.get(_saved_rooms_url(project_id, copied_id))
    assert copied.json()["custom_fields"][0]["id"] == cf_id
