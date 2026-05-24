"""Persisted project-table view-state contract tests for Plan 09."""

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.table_views import repository
from main import app

ORIGIN = "http://localhost:5173"
TABLE_KEY = "rooms"


@pytest.fixture()
def clean_table_view_tables() -> Iterator[None]:
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, user_table_views,
                     project_status_items, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def _signed_in_client(email: str = "ed@example.com", display_name: str = "Ed May") -> TestClient:
    create_or_update_user(email=email, display_name=display_name, password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": "password"},
    )
    assert response.status_code == 200
    return client


def _create_project(client: TestClient, bt_number: str = "2426") -> str:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "West Stockbridge House",
            "bt_number": bt_number,
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def _sample_view_state() -> dict[str, object]:
    return {
        "filter": [],
        "sort": [{"fieldId": "number", "direction": "asc"}],
        "group": [],
        "aggregations": {},
        "columnOrder": ["number", "floor_level", "icfa"],
        "columnWidths": {},
        "hiddenColumns": ["notes"],
        "expandedGroups": {},
    }


def test_get_missing_returns_null_view_state(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    response = client.get(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["view_state"] is None
    assert payload["view_state_schema_version"] == 1
    assert payload["updated_at"] is None


def test_put_then_get_roundtrips_view_state(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    put_response = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )
    assert put_response.status_code == 200
    assert put_response.json()["view_state"] == _sample_view_state()
    assert put_response.json()["updated_at"] is not None

    get_response = client.get(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert get_response.status_code == 200
    assert get_response.json()["view_state"] == _sample_view_state()


def test_put_is_idempotent_upsert(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    first = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )
    assert first.status_code == 200

    next_state = _sample_view_state()
    next_state["hiddenColumns"] = ["notes", "icfa_factor"]
    second = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": next_state},
    )
    assert second.status_code == 200
    assert second.json()["view_state"]["hiddenColumns"] == ["notes", "icfa_factor"]


def test_delete_resets_view(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )
    delete_response = client.delete(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert delete_response.status_code == 204

    get_response = client.get(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert get_response.status_code == 200
    assert get_response.json()["view_state"] is None


def test_delete_missing_row_is_idempotent(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    response = client.delete(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 204


def test_anonymous_get_returns_401(clean_table_view_tables: None) -> None:
    editor = _signed_in_client()
    project_id = _create_project(editor)
    public_client = TestClient(app)

    response = public_client.get(f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}")
    assert response.status_code == 401


def test_anonymous_put_returns_401(clean_table_view_tables: None) -> None:
    editor = _signed_in_client()
    project_id = _create_project(editor)
    public_client = TestClient(app)

    response = public_client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )
    assert response.status_code == 401


def test_anonymous_delete_returns_401(clean_table_view_tables: None) -> None:
    editor = _signed_in_client()
    project_id = _create_project(editor)
    public_client = TestClient(app)

    response = public_client.delete(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 401


def test_invalid_table_key_returns_400(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    response = client.put(
        f"/api/v1/projects/{project_id}/table-views/Rooms-1",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_table_key"


def test_unsupported_schema_version_returns_400(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    response = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 2, "view_state": _sample_view_state()},
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "unsupported_schema_version"


def test_oversized_payload_returns_400(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    big_state = {"filter": ["x" * 70000]}
    response = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": big_state},
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "view_state_too_large"


def test_non_object_view_state_returns_422(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id = _create_project(client)

    response = client.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": [1, 2, 3]},
    )
    assert response.status_code == 422


def test_unknown_project_returns_404(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    _create_project(client)
    missing = uuid4()

    response = client.get(
        f"/api/v1/projects/{missing}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 404


def test_view_state_is_user_scoped(clean_table_view_tables: None) -> None:
    editor_a = _signed_in_client(email="a@example.com", display_name="A")
    project_id = _create_project(editor_a)
    editor_a.put(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )

    editor_b = _signed_in_client(email="b@example.com", display_name="B")
    response_b = editor_b.get(
        f"/api/v1/projects/{project_id}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert response_b.status_code == 200
    assert response_b.json()["view_state"] is None


def test_view_state_is_project_scoped(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_x = _create_project(client, bt_number="2426")
    project_y = _create_project(client, bt_number="2427")

    client.put(
        f"/api/v1/projects/{project_x}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
        json={"view_state_schema_version": 1, "view_state": _sample_view_state()},
    )

    response = client.get(
        f"/api/v1/projects/{project_y}/table-views/{TABLE_KEY}",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    assert response.json()["view_state"] is None


def test_repository_roundtrip(clean_table_view_tables: None) -> None:
    client = _signed_in_client()
    project_id_str = _create_project(client)
    project_id = UUID(project_id_str)

    with connection() as conn:
        user_row = conn.execute(
            "SELECT id FROM users WHERE email = %(email)s",
            {"email": "ed@example.com"},
        ).fetchone()
    assert user_row is not None
    user_id = user_row["id"]

    with transaction() as conn:
        row = repository.upsert(
            conn,
            user_id,
            project_id,
            TABLE_KEY,
            1,
            _sample_view_state(),
            512,
        )
    assert row["view_state"] == _sample_view_state()

    with connection() as conn:
        fetched = repository.get(conn, user_id, project_id, TABLE_KEY)
    assert fetched is not None
    assert fetched["view_state"] == _sample_view_state()
    assert fetched["view_state_size_bytes"] == 512

    with transaction() as conn:
        deleted = repository.delete(conn, user_id, project_id, TABLE_KEY)
    assert deleted is True

    with connection() as conn:
        missing = repository.get(conn, user_id, project_id, TABLE_KEY)
    assert missing is None
