"""Project-document draft contract tests for TB-04."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

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


def draft_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft"


def document_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document"


def save_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save"


def save_as_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save-as"


def version_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}"


def download_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/download"


def rooms_download_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/download/tables/rooms"


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
            "rooms.building_zone": [
                {
                    "id": "opt_residential",
                    "label": "Residential",
                    "color": "#10b981",
                    "order": 0,
                }
            ],
        },
    }


def create_rooms_draft(client: TestClient, project_id: object, version_id: object) -> dict[str, Any]:
    initial = client.get(draft_rooms_url(project_id, version_id)).json()
    created = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json=room_payload(),
    )
    assert created.status_code == 200
    return {"initial": initial, "created": created.json()}


def corrupt_saved_version_schema(version_id: object) -> None:
    with transaction() as conn:
        row = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        raw_body = dict(row["body"])
        raw_body["schema_version"] = 999
        conn.execute(
            """
            UPDATE project_versions
            SET body = %(body)s,
                schema_version = 999
            WHERE id = %(version_id)s
            """,
            {"body": Jsonb(raw_body), "version_id": version_id},
        )


def corrupt_draft_schema(version_id: object) -> None:
    with transaction() as conn:
        row = conn.execute(
            """
            SELECT body
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        raw_body = dict(row["body"])
        raw_body["schema_version"] = 999
        conn.execute(
            """
            UPDATE project_version_drafts
            SET body = %(body)s,
                schema_version = 999
            WHERE version_id = %(version_id)s
            """,
            {"body": Jsonb(raw_body), "version_id": version_id},
        )


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


def test_rooms_replace_noop_does_not_create_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_rooms_url(project_id, version_id))
    assert initial.status_code == 200

    noop = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={
            "rooms": [],
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
            },
        },
    )

    assert noop.status_code == 200
    assert noop.json()["source"] == "version"
    assert noop.json()["draft_etag"] is None
    with connection() as conn:
        draft = conn.execute(
            """
            SELECT version_id
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
    assert draft is None


def test_draft_summary_reports_clean_and_dirty_document_state(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    clean = client.get(draft_url(project_id, version_id))

    assert clean.status_code == 200
    assert clean.json()["source"] == "version"
    assert clean.json()["draft_etag"] is None
    assert clean.json()["dirty_tables"] == []
    assert clean.json()["last_patched_at"] is None
    assert clean.json()["is_locked"] is False
    assert clean.json()["can_edit"] is True

    create_rooms_draft(client, project_id, version_id)
    dirty = client.get(draft_url(project_id, version_id))

    assert dirty.status_code == 200
    assert dirty.json()["source"] == "draft"
    assert dirty.json()["draft_etag"]
    assert dirty.json()["dirty_tables"] == ["rooms"]
    assert dirty.json()["last_patched_at"]
    assert dirty.json()["is_locked"] is False
    assert dirty.json()["can_edit"] is True


def test_draft_summary_reports_locked_state_with_preserved_draft(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    locked = client.patch(
        version_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200

    summary = client.get(draft_url(project_id, version_id))

    assert summary.status_code == 200
    assert summary.json()["source"] == "draft"
    assert summary.json()["dirty_tables"] == ["rooms"]
    assert summary.json()["is_locked"] is True
    assert summary.json()["can_edit"] is False


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
    invalid["rooms"][0]["floor_level"] = None
    response = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=invalid,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "validation_error"

    invalid = room_payload()
    invalid["rooms"].append({**invalid["rooms"][0], "id": "rm_kitchen", "name": "Kitchen"})
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

    invalid = room_payload()
    invalid["rooms"][0]["erv_unit_ids"] = ["erv_fake"]
    response = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=invalid,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"


def test_public_viewer_can_read_rooms_but_not_write(
    clean_document_tables: None,
) -> None:
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


def test_unsupported_table_names_fail_through_registry(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    url = version_url(project_id, version_id)

    saved = client.get(f"{url}/document/tables/windows")
    draft = client.get(f"{url}/draft/tables/windows")
    write = client.put(
        f"{url}/draft/tables/windows",
        headers={"Origin": ORIGIN, "If-Match-Version": "unused"},
        json={"rows": []},
    )
    download = client.get(f"{url}/download/tables/windows", headers={"X-Request-ID": "missing-table"})

    for response in (saved, draft, write, download):
        assert response.status_code == 404
        body = response.json()
        assert body["error_code"] == "document_table_not_found"
        assert body["details"]["supported_tables"] == ["rooms"]

    assert download.headers["X-Request-ID"] == "missing-table"
    assert download.json()["request_id"] == "missing-table"


def test_save_flushes_draft_to_version_and_clears_draft(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    draft = create_rooms_draft(client, project_id, version_id)

    saved = client.post(
        save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft["initial"]["version_etag"]},
    )

    assert saved.status_code == 200
    assert saved.json()["version"]["id"] == version_id
    assert saved.json()["version"]["body_size_bytes"] > 0

    reloaded_saved = client.get(saved_rooms_url(project_id, version_id))
    assert reloaded_saved.json()["source"] == "version"
    assert reloaded_saved.json()["rooms"][0]["name"] == "Living Room"

    reloaded_draft = client.get(draft_rooms_url(project_id, version_id))
    assert reloaded_draft.json()["source"] == "version"

    detail = client.get(f"/api/v1/projects/{project_id}").json()
    assert detail["last_saved_at"] is not None


def test_discard_drops_draft_without_updating_saved_body(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    discarded = client.delete(draft_url(project_id, version_id), headers={"Origin": ORIGIN})

    assert discarded.status_code == 200
    assert discarded.json()["discarded"] is True
    saved = client.get(saved_rooms_url(project_id, version_id))
    assert saved.json()["rooms"] == []
    draft = client.get(draft_rooms_url(project_id, version_id))
    assert draft.json()["source"] == "version"


def test_save_as_creates_active_version_from_draft_and_downloads_json(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    saved_as = client.post(
        save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Round 1 Submit", "kind": "submitted", "locked": False},
    )

    assert saved_as.status_code == 200
    new_version = saved_as.json()["version"]
    assert new_version["id"] != version_id
    assert new_version["kind"] == "submitted"
    assert new_version["locked"] is True
    detail = client.get(f"/api/v1/projects/{project_id}").json()
    assert detail["active_version_id"] == new_version["id"]

    project_json = client.get(download_url(project_id, new_version["id"]))
    assert project_json.status_code == 200
    assert project_json.headers["content-disposition"].startswith("attachment;")
    assert project_json.json()["tables"]["rooms"][0]["id"] == "rm_living"

    rooms_json = client.get(rooms_download_url(project_id, new_version["id"]))
    assert rooms_json.status_code == 200
    assert rooms_json.json()["rooms"][0]["name"] == "Living Room"


def test_project_download_returns_raw_body_when_schema_is_invalid(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    corrupt_saved_version_schema(version_id)

    rooms = client.get(saved_rooms_url(project_id, version_id))
    assert rooms.status_code == 422
    assert rooms.json()["error_code"] == "invalid_project_document"

    document = client.get(document_url(project_id, version_id), headers={"X-Request-ID": "schema-safe"})
    assert document.status_code == 200
    document_body = document.json()
    assert document_body["schema_version_unsupported"] is True
    assert document_body["schema_version"] == 999
    assert document_body["current_schema_version"] == 1
    assert document_body["error_code"] == "schema_validation_failed_after_migration"
    assert document_body["request_id"] == "schema-safe"
    assert document_body["body"]["schema_version"] == 999
    assert document_body["validation_errors"] == []

    public_document = TestClient(app).get(
        document_url(project_id, version_id),
        headers={"X-Request-ID": "public-safe"},
    )
    assert public_document.status_code == 200
    public_document_body = public_document.json()
    assert public_document_body["schema_version_unsupported"] is True
    assert public_document_body["request_id"] == "public-safe"
    assert public_document_body["validation_errors"] == []

    draft = client.get(draft_url(project_id, version_id), headers={"X-Request-ID": "draft-safe"})
    assert draft.status_code == 200
    draft_body = draft.json()
    assert draft_body["schema_version_unsupported"] is True
    assert draft_body["source"] == "version"
    assert draft_body["request_id"] == "draft-safe"
    assert len(draft_body["validation_errors"]) > 0

    project_json = client.get(download_url(project_id, version_id))
    assert project_json.status_code == 200
    assert project_json.json()["schema_version"] == 999


def test_draft_summary_returns_read_safe_envelope_when_draft_body_is_invalid(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    corrupt_draft_schema(version_id)

    draft = client.get(draft_url(project_id, version_id), headers={"X-Request-ID": "draft-body-safe"})
    assert draft.status_code == 200
    body = draft.json()
    assert body["schema_version_unsupported"] is True
    assert body["source"] == "draft"
    assert body["schema_version"] == 999
    assert body["request_id"] == "draft-body-safe"
    assert body["body"]["schema_version"] == 999
    assert len(body["validation_errors"]) > 0


def test_save_as_without_draft_copies_saved_body(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    saved_as = client.post(
        save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Working Copy", "kind": "working", "locked": False},
    )

    assert saved_as.status_code == 200
    copied_version = saved_as.json()["version"]
    assert copied_version["id"] != version_id
    copied_rooms = client.get(saved_rooms_url(project_id, copied_version["id"]))
    assert copied_rooms.status_code == 200
    assert copied_rooms.json()["rooms"] == []


def test_save_as_rejects_duplicate_version_name(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    first = client.post(
        save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Duplicate Name", "kind": "working", "locked": False},
    )
    duplicate = client.post(
        save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Duplicate Name", "kind": "working", "locked": False},
    )

    assert first.status_code == 200
    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "version_name_taken"


def test_lock_blocks_save_and_draft_writes_but_save_as_still_copies(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    draft = create_rooms_draft(client, project_id, version_id)

    locked = client.patch(
        version_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200
    assert locked.json()["active_version"]["locked"] is True

    save = client.post(
        save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft["initial"]["version_etag"]},
    )
    assert save.status_code == 409
    assert save.json()["error_code"] == "version_locked"

    write = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": draft["created"]["draft_etag"]},
        json={**room_payload(), "rooms": []},
    )
    assert write.status_code == 409
    assert write.json()["error_code"] == "version_locked"

    copied = client.post(
        save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Unlocked Copy", "kind": "working", "locked": False},
    )
    assert copied.status_code == 200
    assert copied.json()["version"]["locked"] is False


def test_stale_save_preserves_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    stale = client.post(
        save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": "stale"},
    )

    assert stale.status_code == 409
    assert stale.json()["error_code"] == "version_etag_mismatch"
    draft = client.get(draft_rooms_url(project_id, version_id))
    assert draft.json()["source"] == "draft"
    assert draft.json()["rooms"][0]["id"] == "rm_living"


def test_diff_reports_room_field_changes(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id)

    diff = client.get(f"/api/v1/projects/{project_id}/diff?from={version_id}&to=draft")

    assert diff.status_code == 200
    rooms_diff = diff.json()["tables"][0]
    assert rooms_diff["table"] == "rooms"
    assert rooms_diff["change_count"] > 0
    assert "rooms.rooms[rm_living]" in rooms_diff["changed_paths"]


def test_draft_summary_and_diff_include_rooms_option_only_changes(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_rooms_url(project_id, version_id))

    updated = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={
            "rooms": [],
            "single_select_options": {
                "rooms.floor_level": [{"id": "opt_ground", "label": "Grade", "color": "#3b82f6", "order": 0}],
                "rooms.building_zone": [],
            },
        },
    )
    assert updated.status_code == 200

    summary = client.get(draft_url(project_id, version_id))
    assert summary.status_code == 200
    assert summary.json()["source"] == "draft"
    assert summary.json()["dirty_tables"] == ["rooms"]

    diff = client.get(f"/api/v1/projects/{project_id}/diff?from={version_id}&to=draft")
    assert diff.status_code == 200
    rooms_diff = diff.json()["tables"][0]
    assert rooms_diff["table"] == "rooms"
    assert rooms_diff["change_count"] > 0
    assert "rooms.single_select_options.rooms.floor_level[opt_ground]" in rooms_diff["changed_paths"]
