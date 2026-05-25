"""Project shell contract tests for TB-02."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
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
    assert version["body"]["schema_version"] == 2
    assert version["body"]["project"]["cert_programs"] == ["phi", "phius"]
    assert version["body"]["tables"]["rooms"] == {"custom_fields": [], "rows": []}
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
