"""Project lifecycle status contract tests for TB-03."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_status_tables() -> Iterator[None]:
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


def create_project(client: TestClient) -> str:
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
    return str(response.json()["id"])


def test_default_template_applies_once_to_empty_status_list(clean_status_tables: None) -> None:
    client = signed_in_client()
    project_id = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project_id}/status-items/apply-default-template",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["title"] for item in items] == [
        "CAD files received",
        "Design Model complete",
        "Cert review complete",
        "Certification Complete",
    ]
    assert [item["state"] for item in items] == ["todo", "todo", "todo", "todo"]
    assert [item["order_index"] for item in items] == [1.0, 2.0, 3.0, 4.0]

    duplicate = client.post(
        f"/api/v1/projects/{project_id}/status-items/apply-default-template",
        headers={"Origin": ORIGIN},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "status_template_not_empty"


def test_public_viewer_can_read_but_not_mutate_status_items(clean_status_tables: None) -> None:
    editor = signed_in_client()
    project_id = create_project(editor)
    created = editor.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "CAD files received"},
    )
    assert created.status_code == 201

    public_client = TestClient(app)
    list_response = public_client.get(f"/api/v1/projects/{project_id}/status-items")
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["title"] == "CAD files received"

    write_response = public_client.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "Design Model complete"},
    )
    assert write_response.status_code == 401
    assert write_response.json()["error_code"] == "not_authenticated"


def test_state_done_autopopulates_completion_date_and_preserves_it(clean_status_tables: None) -> None:
    client = signed_in_client()
    project_id = create_project(client)
    created = client.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "CAD files received"},
    )
    item_id = created.json()["id"]

    done = client.patch(
        f"/api/v1/projects/{project_id}/status-items/{item_id}",
        headers={"Origin": ORIGIN},
        json={"state": "done"},
    )
    assert done.status_code == 200
    assert done.json()["completion_date"] == date.today().isoformat()

    na = client.patch(
        f"/api/v1/projects/{project_id}/status-items/{item_id}",
        headers={"Origin": ORIGIN},
        json={"state": "na"},
    )
    assert na.status_code == 200
    assert na.json()["completion_date"] == date.today().isoformat()

    cleared = client.patch(
        f"/api/v1/projects/{project_id}/status-items/{item_id}",
        headers={"Origin": ORIGIN},
        json={"completion_date": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["completion_date"] is None


def test_create_done_item_gets_completion_date_and_can_be_backdated(clean_status_tables: None) -> None:
    client = signed_in_client()
    project_id = create_project(client)

    created = client.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "CAD files received", "state": "done"},
    )

    assert created.status_code == 201
    assert created.json()["completion_date"] == date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    updated = client.patch(
        f"/api/v1/projects/{project_id}/status-items/{created.json()['id']}",
        headers={"Origin": ORIGIN},
        json={"completion_date": yesterday},
    )
    assert updated.status_code == 200
    assert updated.json()["completion_date"] == yesterday


def test_reorder_and_soft_delete_status_item(clean_status_tables: None) -> None:
    client = signed_in_client()
    project_id = create_project(client)
    first = client.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "First"},
    ).json()
    second = client.post(
        f"/api/v1/projects/{project_id}/status-items",
        headers={"Origin": ORIGIN},
        json={"title": "Second"},
    ).json()

    moved = client.patch(
        f"/api/v1/projects/{project_id}/status-items/{second['id']}",
        headers={"Origin": ORIGIN},
        json={"order_index": 0.5},
    )
    assert moved.status_code == 200

    listed = client.get(f"/api/v1/projects/{project_id}/status-items")
    assert [item["title"] for item in listed.json()["items"]] == ["Second", "First"]

    deleted = client.delete(
        f"/api/v1/projects/{project_id}/status-items/{first['id']}",
        headers={"Origin": ORIGIN},
    )
    assert deleted.status_code == 204
    listed_after_delete = client.get(f"/api/v1/projects/{project_id}/status-items")
    assert [item["title"] for item in listed_after_delete.json()["items"]] == ["Second"]

    with connection() as conn:
        row = conn.execute(
            """
            SELECT deleted_at IS NOT NULL AS deleted
            FROM project_status_items
            WHERE id = %(item_id)s
            """,
            {"item_id": first["id"]},
        ).fetchone()
    assert row == {"deleted": True}
