"""Phase 01 tests for the Grasshopper Data API foundation.

Covers the resolver route envelope, bt_number → project resolution, version
resolution (default / pinned / unknown), the three-tier access matrix
(anonymous / session / bearer), and the per-IP rate limiter.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from psycopg.errors import UniqueViolation

from config import settings
from database import connection, transaction
from features.access.principals import ViewerPrincipal
from features.gh_api import repository, service
from features.gh_api.rate_limit import reset_rate_limiter
from features.projects.access import ProjectAccess
from features.projects.models import ProjectSummary
from main import app
from tests.test_project_document import ORIGIN, signed_in_client


def _create_project(client: TestClient, bt_number: str, name: str = "GH Fixture") -> dict[str, Any]:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": name,
            "bt_number": bt_number,
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _issue_token(client: TestClient, project_id: object) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "gh-test", "scopes": ["project:read"]},
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def _gh_url(bt_number: str) -> str:
    return f"/api/v1/gh/projects/{bt_number}"


def _anon_access(bt_number: str) -> ProjectAccess:
    """Build an anonymous view access straight from the DB (unit-testing helper)."""
    with connection() as conn:
        row = repository.get_live_project_by_bt_number(conn, bt_number)
    assert row is not None
    project = ProjectSummary.model_validate({field: row[field] for field in ProjectSummary.model_fields})
    return ProjectAccess(project_id=project.id, mode="view", principal=ViewerPrincipal(), project=project)


# --- resolver route ---------------------------------------------------------


def test_resolver_envelope_shape(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = _create_project(client, "2524")

    response = TestClient(app).get(_gh_url("2524"))
    assert response.status_code == 200, response.text
    body = response.json()

    assert set(body) == {"schema_version", "project", "version_id", "last_modified", "versions"}
    assert body["schema_version"] == 1
    assert body["project"] == {
        "bt_number": "2524",
        "project_id": project["id"],
        "name": "GH Fixture",
    }
    assert body["version_id"] == project["active_version_id"]
    assert body["last_modified"].endswith("Z")
    assert len(body["versions"]) == 1
    assert set(body["versions"][0]) == {"version_id", "saved_at", "name", "kind"}
    assert body["versions"][0]["version_id"] == project["active_version_id"]


def test_resolver_unknown_bt_number_is_404(clean_document_tables: None) -> None:
    response = TestClient(app).get(_gh_url("9999"))
    assert response.status_code == 404
    assert response.json()["error_code"] == "project_not_found"


def test_resolver_lists_versions_newest_first(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = _create_project(client, "2524")
    # A save-as creates a second saved version on the same project.
    response = client.post(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/draft/save-as",
        headers={"Origin": ORIGIN},
        json={"name": "Snapshot A"},
    )
    assert response.status_code in (200, 201), response.text

    versions = TestClient(app).get(_gh_url("2524")).json()["versions"]
    assert len(versions) >= 2
    saved_ats = [v["saved_at"] for v in versions]
    assert saved_ats == sorted(saved_ats, reverse=True)


# --- version resolution -----------------------------------------------------


def test_resolve_version_defaults_to_active(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = _create_project(client, "2524")
    access = _anon_access("2524")

    resolved = service.resolve_version(access, None)
    assert str(resolved.version_id) == project["active_version_id"]


def test_resolve_version_pins_requested_version(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = _create_project(client, "2524")
    access = _anon_access("2524")

    resolved = service.resolve_version(access, UUID(str(project["active_version_id"])))
    assert str(resolved.version_id) == project["active_version_id"]


def test_resolve_version_unknown_is_404(clean_document_tables: None) -> None:
    signed_in_client_ = signed_in_client()
    _create_project(signed_in_client_, "2524")
    access = _anon_access("2524")

    with pytest.raises(Exception) as excinfo:
        service.resolve_version(access, uuid4())
    assert getattr(excinfo.value, "status_code", None) == 404


# --- access matrix ----------------------------------------------------------


def test_anonymous_read_is_allowed(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2524")
    assert TestClient(app).get(_gh_url("2524")).status_code == 200


def test_session_cookie_read_is_allowed(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2524")
    assert client.get(_gh_url("2524")).status_code == 200


def test_valid_bearer_for_project_is_allowed(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = _create_project(client, "2524")
    token = _issue_token(client, project["id"])

    response = TestClient(app).get(_gh_url("2524"), headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text


def test_bearer_for_wrong_project_is_403(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_a = _create_project(client, "2524", name="A")
    _create_project(client, "2525", name="B")
    token_a = _issue_token(client, project_a["id"])

    # Token scoped to 2524, used against 2525.
    response = TestClient(app).get(_gh_url("2525"), headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 403, response.text
    assert response.json()["error_code"] == "forbidden"


def test_malformed_bearer_is_401(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2524")

    response = TestClient(app).get(_gh_url("2524"), headers={"Authorization": "Bearer phn_mcp_not_a_real_token"})
    assert response.status_code == 401, response.text
    assert response.json()["error_code"] == "invalid_token"


# --- bt_number partial-unique index -----------------------------------------


def test_duplicate_live_bt_number_is_rejected(clean_document_tables: None) -> None:
    client = signed_in_client()
    _create_project(client, "2524", name="A")
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "B",
            "bt_number": "2524",
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 409, response.text
    assert response.json()["error_code"] == "bt_number_taken"


def _insert_sibling_project(source_id: object, name: str, bt_number: str) -> str:
    """Insert a raw project row reusing an existing project's owner; return its id.

    Exercises the DB index directly, below the app-level bt_number guard.
    """
    with transaction() as conn:
        row = conn.execute(
            """
            INSERT INTO projects (name, bt_number, owner_id)
            SELECT %(name)s, %(bt_number)s, owner_id FROM projects WHERE id = %(source_id)s
            RETURNING id
            """,
            {"name": name, "bt_number": bt_number, "source_id": source_id},
        ).fetchone()
    assert row is not None
    return str(row["id"])


def test_partial_index_rejects_duplicate_live_bt_number(clean_document_tables: None) -> None:
    client = signed_in_client()
    first = _create_project(client, "2524", name="A")
    # The partial unique index is the invariant behind the app-level 409.
    with pytest.raises(UniqueViolation):
        _insert_sibling_project(first["id"], "B", "2524")


def test_partial_index_frees_bt_number_after_soft_delete(clean_document_tables: None) -> None:
    client = signed_in_client()
    first = _create_project(client, "2524", name="A")
    # Soft-delete at the DB level (the app guard deliberately still blocks reuse
    # to protect restore); the partial index covers only live rows, so the value
    # is now insertable again.
    with transaction() as conn:
        conn.execute("UPDATE projects SET deleted_at = now() WHERE id = %(id)s", {"id": first["id"]})
    reused_id = _insert_sibling_project(first["id"], "B", "2524")

    # bt_number resolution keys on live rows only, so it now finds the reused project.
    with connection() as conn:
        row = repository.get_live_project_by_bt_number(conn, "2524")
    assert row is not None
    assert str(row["id"]) == reused_id


# --- rate limiting ----------------------------------------------------------


def test_rate_limiter_returns_429_over_budget(clean_document_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    _create_project(client, "2524")
    monkeypatch.setattr(settings, "gh_api_rate_limit_enabled", True)
    monkeypatch.setattr(settings, "gh_api_rate_limit_per_minute", 3)
    reset_rate_limiter()
    anon = TestClient(app)
    try:
        statuses = [anon.get(_gh_url("2524")).status_code for _ in range(5)]
    finally:
        reset_rate_limiter()

    assert statuses[:3] == [200, 200, 200]
    assert 429 in statuses[3:]
