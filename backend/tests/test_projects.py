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
    assert version["body"]["schema_version"] == 1
    assert version["body"]["project"]["cert_programs"] == ["phi", "phius"]
    assert version["body"]["tables"]["rooms"] == []
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


def test_public_project_detail_is_readable_without_session(clean_project_tables: None) -> None:
    editor = signed_in_client()
    created = editor.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=create_project_payload())
    project_id = created.json()["id"]

    public_client = TestClient(app)
    response = public_client.get(f"/api/v1/projects/{project_id}")

    assert response.status_code == 200
    assert response.json()["access_mode"] == "viewer"
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
