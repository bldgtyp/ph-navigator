"""Project shell contract tests for TB-02."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.projects.models import ProjectHardDeleteRequest
from features.projects.service import hard_delete_project
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_project_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, project_status_items,
                     project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )
    yield
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, project_status_items,
                     project_versions, projects, users
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


def create_project_payload(bt_number: str = "2426") -> dict[str, object]:
    return {
        "name": "West Stockbridge House",
        "bt_number": bt_number,
        "client": "May",
        "cert_programs": ["phi", "phius"],
        "phius_number": "P-1234",
        "phius_dropbox_url": None,
    }


def create_project(client: TestClient, bt_number: str = "2426") -> dict[str, object]:
    response = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload(bt_number))
    assert response.status_code == 201
    return response.json()


def test_create_project_inserts_initial_working_version(clean_project_tables: None) -> None:
    client = signed_in_client()

    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json=create_project_payload(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "West Stockbridge House"
    assert payload["bt_number"] == "2426"
    assert payload["client"] == "May"
    assert payload["access_mode"] == "editor"
    assert payload["active_version"]["name"] == "Working"
    assert payload["active_version"]["kind"] == "working"
    assert payload["active_version"]["locked"] is False

    with connection() as conn:
        version = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": payload["active_version_id"]},
        ).fetchone()
        action = conn.execute(
            """
            SELECT action, details->>'bt_number' AS bt_number
            FROM user_action_log
            WHERE action = 'project_create'
            """
        ).fetchone()

    assert version is not None
    assert version["body"]["schema_version"] == 5
    assert version["body"]["project"]["cert_programs"] == ["phi", "phius"]
    assert version["body"]["tables"]["rooms"]["rows"] == []
    assert version["body"]["tables"]["rooms"]["field_defs"][0]["field_key"] == "record_id"
    assert version["body"]["tables"]["equipment"]["pumps"]["field_defs"][0]["field_key"] == "record_id"
    assert action == {"action": "project_create", "bt_number": "2426"}


def test_dashboard_list_is_filtered_to_owner(clean_project_tables: None) -> None:
    client = signed_in_client()
    other_user = create_or_update_user(email="john@example.com", display_name="John Mitchell", password="password")
    client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    with transaction() as conn:
        conn.execute(
            """
            INSERT INTO projects (name, bt_number, owner_id)
            VALUES ('Other Project', '2427', %(owner_id)s)
            """,
            {"owner_id": other_user.id},
        )

    response = client.get("/api/v1/projects")

    assert response.status_code == 200
    projects = response.json()["projects"]
    assert [project["bt_number"] for project in projects] == ["2426"]


def test_dashboard_list_is_ordered_by_bt_number_desc(clean_project_tables: None) -> None:
    client = signed_in_client()
    client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2425"))
    client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2427"))
    client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))

    response = client.get("/api/v1/projects")

    assert response.status_code == 200
    projects = response.json()["projects"]
    assert [project["bt_number"] for project in projects] == ["2427", "2426", "2425"]


def test_bt_number_uniqueness_and_check_endpoint(clean_project_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    assert created.status_code == 201

    check = client.get("/api/v1/projects/check-bt-number?value=2426")
    assert check.status_code == 200
    assert check.json()["available"] is False
    assert check.json()["conflict"]["name"] == "West Stockbridge House"

    duplicate = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json=create_project_payload("2426"),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "bt_number_taken"


def test_editor_can_soft_delete_list_deleted_and_restore_project(clean_project_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]

    delete = client.post(f"/api/v1/projects/{project_id}/delete", headers={"Origin": ORIGIN}, json={"confirm": True})

    assert delete.status_code == 200
    delete_body = delete.json()
    assert delete_body["project_id"] == project_id
    assert delete_body["mode"] == "soft"
    assert delete_body["already_deleted"] is False
    assert delete_body["hard_delete_after"] is not None
    assert delete_body["counts"]["versions"] == 1

    assert client.get("/api/v1/projects").json()["projects"] == []
    gone = client.get(f"/api/v1/projects/{project_id}")
    assert gone.status_code == 410
    assert gone.json()["error_code"] == "project_deleted"
    assert gone.json()["details"]["recoverability"] == "restore"

    deleted = client.get("/api/v1/projects/deleted")
    assert deleted.status_code == 200
    assert [item["id"] for item in deleted.json()["projects"]] == [project_id]
    assert deleted.json()["projects"][0]["counts"]["versions"] == 1

    restore = client.post(f"/api/v1/projects/{project_id}/restore", headers={"Origin": ORIGIN})
    assert restore.status_code == 200
    assert restore.json()["id"] == project_id
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 200
    assert [item["id"] for item in client.get("/api/v1/projects").json()["projects"]] == [project_id]


def test_bulk_delete_projects_deduplicates_and_returns_item_errors(clean_project_tables: None) -> None:
    client = signed_in_client()
    first = create_project(client, "2425")
    second = create_project(client, "2426")
    missing_project_id = str(uuid4())

    response = client.post(
        "/api/v1/projects/bulk-delete",
        headers={"Origin": ORIGIN},
        json={"project_ids": [first["id"], second["id"], first["id"], missing_project_id], "confirm": True},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["project_id"] for item in items] == [first["id"], second["id"], missing_project_id]
    assert [item["ok"] for item in items] == [True, True, False]
    assert items[2]["error_code"] == "project_not_found"
    assert client.get("/api/v1/projects").json()["projects"] == []


@dataclass
class _FakeDeleteObjectsResult:
    deleted_object_count: int
    failed_object_keys: list[str]


class _FakeProjectStorage:
    def __init__(self) -> None:
        self.listed_prefixes: list[str] = []
        self.deleted_keys: list[str] = []

    def list_object_keys(self, prefix: str) -> list[str]:
        self.listed_prefixes.append(prefix)
        return [f"{prefix}source.pdf", f"{prefix}source.thumb.webp"]

    def delete_objects(self, object_keys: list[str]) -> _FakeDeleteObjectsResult:
        self.deleted_keys = list(object_keys)
        return _FakeDeleteObjectsResult(deleted_object_count=len(object_keys), failed_object_keys=[])


def test_hard_delete_removes_project_children_and_storage_prefix(clean_project_tables: None) -> None:
    client = signed_in_client()
    user = create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    project = create_project(client)
    project_id = UUID(cast(str, project["id"]))
    version_id = UUID(cast(str, project["active_version_id"]))
    object_key = f"projects/{project_id}/assets/source.pdf"
    thumbnail_key = f"projects/{project_id}/assets/source.thumb.webp"

    with transaction() as conn:
        body_row = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        assert body_row is not None
        body = body_row["body"]
        conn.execute(
            """
            INSERT INTO project_version_drafts (
                version_id, user_id, body, schema_version, base_version_etag, draft_etag
            )
            VALUES (
                %(version_id)s, %(user_id)s, %(body)s, 4, 'base-etag', 'draft-etag'
            )
            """,
            {"version_id": version_id, "user_id": user.id, "body": Jsonb(body)},
        )
        conn.execute(
            """
            INSERT INTO project_status_items (project_id, order_index, title, state, created_by, updated_by)
            VALUES (%(project_id)s, 0, 'Review envelope', 'todo', %(user_id)s, %(user_id)s)
            """,
            {"project_id": project_id, "user_id": user.id},
        )
        conn.execute(
            """
            INSERT INTO project_assets (
                id, project_id, asset_kind, object_key, original_filename, display_name,
                content_type, size_bytes, content_hash_sha256, upload_status, created_by,
                uploaded_at, metadata
            )
            VALUES (
                'asset_1', %(project_id)s, 'datasheet', %(object_key)s, 'source.pdf', 'Source',
                'application/pdf', 42, 'hash', 'uploaded', %(user_id)s, now(), %(metadata)s
            )
            """,
            {
                "project_id": project_id,
                "object_key": object_key,
                "user_id": user.id,
                "metadata": Jsonb({"thumbnail_object_key": thumbnail_key}),
            },
        )
        conn.execute(
            """
            INSERT INTO project_jobs (id, project_id, job_type, status, progress, created_by, result_asset_id)
            VALUES ('job_1', %(project_id)s, 'asset_bulk_download', 'completed', 100, %(user_id)s, 'asset_1')
            """,
            {"project_id": project_id, "user_id": user.id},
        )
        conn.execute(
            """
            INSERT INTO mcp_tokens (
                project_id, issued_by_user_id, label, token_hash, token_prefix, scopes
            )
            VALUES (%(project_id)s, %(user_id)s, 'Cleanup', 'hash-token', 'phn_mcp_', ARRAY['project:read'])
            """,
            {"project_id": project_id, "user_id": user.id},
        )
        conn.execute(
            """
            INSERT INTO user_table_views (
                user_id, project_id, table_key, view_state_schema_version, view_state, view_state_size_bytes
            )
            VALUES (%(user_id)s, %(project_id)s, 'rooms', 1, %(view_state)s, 2)
            """,
            {"user_id": user.id, "project_id": project_id, "view_state": Jsonb({})},
        )

    storage = _FakeProjectStorage()
    result = hard_delete_project(
        project_id,
        ProjectHardDeleteRequest(
            confirm_project_name=cast(str, project["name"]),
            confirm_bt_number=cast(str, project["bt_number"]),
        ),
        user=user,
        storage=storage,
    )

    assert result.deleted is True
    assert result.counts.model_dump() == {
        "versions": 1,
        "drafts": 1,
        "status_items": 1,
        "assets": 1,
        "jobs": 1,
        "mcp_tokens": 1,
        "table_views": 1,
    }
    assert storage.listed_prefixes == [f"projects/{project_id}/assets/"]
    assert storage.deleted_keys == [f"projects/{project_id}/assets/source.pdf", thumbnail_key]
    assert result.manifest["object_keys"] == [object_key, thumbnail_key]

    with connection() as conn:
        row_counts = conn.execute(
            """
            SELECT
                (SELECT count(*) FROM projects WHERE id = %(project_id)s) AS projects,
                (SELECT count(*) FROM project_versions WHERE project_id = %(project_id)s) AS versions,
                (SELECT count(*) FROM project_assets WHERE project_id = %(project_id)s) AS assets,
                (SELECT count(*) FROM project_jobs WHERE project_id = %(project_id)s) AS jobs,
                (SELECT count(*) FROM mcp_tokens WHERE project_id = %(project_id)s) AS mcp_tokens,
                (SELECT count(*) FROM user_table_views WHERE project_id = %(project_id)s) AS table_views
            """,
            {"project_id": project_id},
        ).fetchone()
    assert row_counts == {
        "projects": 0,
        "versions": 0,
        "assets": 0,
        "jobs": 0,
        "mcp_tokens": 0,
        "table_views": 0,
    }


def test_editor_can_patch_project_metadata_with_self_bt_number(clean_project_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    assert created.status_code == 201
    project_id = created.json()["id"]

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Origin": ORIGIN},
        json={
            "name": "West Stockbridge Retrofit",
            "bt_number": "2426",
            "client": "May Studio",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": "https://dropbox.example.com/cert",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "West Stockbridge Retrofit"
    assert payload["bt_number"] == "2426"
    assert payload["client"] == "May Studio"
    assert payload["cert_programs"] == ["phi"]
    assert payload["phius_number"] is None
    assert payload["phius_dropbox_url"] == "https://dropbox.example.com/cert"
    assert payload["owner_display_name"] == "Ed May"

    with connection() as conn:
        action = conn.execute(
            """
            SELECT action, details->>'project_id' AS project_id
            FROM user_action_log
            WHERE action = 'project_update_metadata'
            """
        ).fetchone()

    assert action == {"action": "project_update_metadata", "project_id": project_id}


def test_patch_project_metadata_skips_noop_update_and_audit(clean_project_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    assert created.status_code == 201
    project_id = created.json()["id"]
    updated_at = created.json()["updated_at"]

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Origin": ORIGIN},
        json={"name": "West Stockbridge House", "cert_programs": ["phius", "phi"]},
    )

    assert response.status_code == 200
    assert response.json()["updated_at"] == updated_at
    with connection() as conn:
        action_count = conn.execute(
            """
            SELECT count(*) AS count
            FROM user_action_log
            WHERE action = 'project_update_metadata'
            """
        ).fetchone()

    assert action_count == {"count": 0}


def test_patch_project_metadata_rejects_duplicate_bt_number(clean_project_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    other = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2427"))
    assert created.status_code == 201
    assert other.status_code == 201

    response = client.patch(
        f"/api/v1/projects/{created.json()['id']}",
        headers={"Origin": ORIGIN},
        json={"bt_number": "2427"},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "bt_number_taken"


@pytest.mark.parametrize(
    "payload",
    [{"name": "   "}, {"name": None}, {"bt_number": "   "}, {"bt_number": None}, {"cert_programs": None}],
)
def test_patch_project_metadata_rejects_clearing_required_fields(
    clean_project_tables: None,
    payload: dict[str, object],
) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload("2426"))
    assert created.status_code == 201

    response = client.patch(
        f"/api/v1/projects/{created.json()['id']}",
        headers={"Origin": ORIGIN},
        json=payload,
    )

    assert response.status_code == 422


def test_public_project_detail_is_readable_without_session(clean_project_tables: None) -> None:
    editor = signed_in_client()
    created = editor.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload())
    project_id = created.json()["id"]

    public_client = TestClient(app)
    response = public_client.get(f"/api/v1/projects/{project_id}")

    assert response.status_code == 200
    assert response.json()["access_mode"] == "viewer"
    assert response.json()["owner_display_name"] is None
    assert response.json()["active_version"]["name"] == "Working"


def test_representative_project_write_rejects_public_viewer(clean_project_tables: None) -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json=create_project_payload(),
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_public_viewer_cannot_patch_project_metadata(clean_project_tables: None) -> None:
    editor = signed_in_client()
    created = editor.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload())
    project_id = created.json()["id"]
    public_client = TestClient(app)

    response = public_client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Origin": ORIGIN},
        json={"name": "Public Rename"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"
