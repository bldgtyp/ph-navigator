"""Ownership contract for project-scoped access."""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Literal, cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from database import transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE, PROJECT_ACCESS_ALL
from features.auth import repository as auth_repository
from features.auth.service import create_or_update_user
from features.mcp.tools_documents import tool_get_document
from features.mcp.tools_projects import tool_get_project
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def clean_project_access_tables() -> Iterator[None]:
    statement = """
        TRUNCATE user_action_log, sessions, project_status_items,
                 project_versions, project_location, projects, users
        RESTART IDENTITY CASCADE
    """
    with transaction() as conn:
        conn.execute(statement)
    yield
    with transaction() as conn:
        conn.execute(statement)


def _login_client(email: str) -> TestClient:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": "password"},
    )
    assert response.status_code == 200, response.text
    return client


def _signed_in_client(email: str, display_name: str) -> TestClient:
    create_or_update_user(email=email, display_name=display_name, password="password")
    return _login_client(email)


def _project_payload() -> dict[str, object]:
    return {
        "name": "Ed Private House",
        "bt_number": "2601",
        "client": "Ed Client",
        "cert_programs": ["phi"],
        "phius_number": "P-2601",
        "phius_dropbox_url": "https://example.com/private",
    }


@dataclass(frozen=True)
class OwnedProject:
    project_id: str
    version_id: str
    owner: TestClient


@pytest.fixture()
def owned_project() -> OwnedProject:
    owner = _signed_in_client("ed@example.com", "Ed May")
    created = owner.post("/api/v1/projects", headers={"Origin": ORIGIN}, json=_project_payload())
    assert created.status_code == 201, created.text
    body = created.json()
    return OwnedProject(
        project_id=str(body["id"]),
        version_id=str(body["active_version_id"]),
        owner=owner,
    )


@pytest.fixture()
def stranger_client() -> TestClient:
    return _signed_in_client("john@example.com", "John Mitchell")


def _elevated_client(actor: Literal["admin", "staff"]) -> TestClient:
    email = f"{actor}@example.com"
    user = create_or_update_user(email=email, display_name=f"{actor.title()} User", password="password")
    with transaction() as conn:
        if actor == "admin":
            access_repository.ensure_global_grant(
                conn,
                user_id=user.id,
                capability=ADMIN_USERS_MANAGE,
                granted_by=None,
            )
        else:
            auth_repository.set_user_is_staff(conn, user.id, True)
    return _login_client(email)


def test_stranger_cannot_read_owned_project(owned_project: OwnedProject, stranger_client: TestClient) -> None:
    response = stranger_client.get(f"/api/v1/projects/{owned_project.project_id}")

    assert response.status_code == 404
    assert response.json()["error_code"] == "project_not_found"


def test_stranger_cannot_edit_owned_project(owned_project: OwnedProject, stranger_client: TestClient) -> None:
    response = stranger_client.patch(
        f"/api/v1/projects/{owned_project.project_id}",
        headers={"Origin": ORIGIN},
        json={"name": "Hijacked by John"},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "project_not_found"


def test_stranger_dashboard_stays_filtered_to_owner(
    owned_project: OwnedProject,
    stranger_client: TestClient,
) -> None:
    response = stranger_client.get("/api/v1/projects")

    assert response.status_code == 200
    assert response.json()["projects"] == []


def test_stranger_cannot_reach_representative_project_surfaces(
    owned_project: OwnedProject,
    stranger_client: TestClient,
) -> None:
    project_id = owned_project.project_id
    version_id = owned_project.version_id
    missing_id = "00000000-0000-0000-0000-000000000000"
    paths = {
        "project_document": f"/api/v1/projects/{project_id}/versions/{version_id}/document",
        "apertures": f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/spec-report",
        "envelope": f"/api/v1/projects/{project_id}/versions/{version_id}/envelope",
        "model_viewer": f"/api/v1/projects/{project_id}/hbjson-files/{missing_id}/model_data",
        "assets": f"/api/v1/projects/{project_id}/assets/missing-asset/url",
        "project_status": f"/api/v1/projects/{project_id}/status-items",
    }

    for surface, path in paths.items():
        response = stranger_client.get(path)

        assert response.status_code == 404, surface
        assert response.json()["error_code"] == "project_not_found", surface


def test_mcp_tools_recheck_issuer_project_access(
    owned_project: OwnedProject,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    issued = owned_project.owner.post(
        f"/api/v1/projects/{owned_project.project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Ownership transfer regression", "scopes": ["project:read"]},
    )
    assert issued.status_code == 201, issued.text
    stranger = create_or_update_user(
        email="john@example.com",
        display_name="John Mitchell",
        password="password",
    )
    with transaction() as conn:
        conn.execute(
            "UPDATE projects SET owner_id = %(owner_id)s WHERE id = %(project_id)s",
            {"owner_id": stranger.id, "project_id": owned_project.project_id},
        )
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])

    with pytest.raises(ToolError) as exc_info:
        tool_get_project(
            owned_project.project_id,
            cast(Context, None),
            allow_env_token=True,
        )

    error = json.loads(str(exc_info.value))
    assert error["code"] == "project_not_found"
    assert error["recoverability"] == "refresh"

    with pytest.raises(ToolError) as exc_info:
        tool_get_document(
            owned_project.project_id,
            owned_project.version_id,
            cast(Context, None),
            allow_env_token=True,
        )

    error = json.loads(str(exc_info.value))
    assert error["code"] == "project_not_found"
    assert error["recoverability"] == "refresh"


def test_owner_can_read_and_edit_owned_project(
    owned_project: OwnedProject,
) -> None:
    detail = owned_project.owner.get(f"/api/v1/projects/{owned_project.project_id}")
    updated = owned_project.owner.patch(
        f"/api/v1/projects/{owned_project.project_id}",
        headers={"Origin": ORIGIN},
        json={"name": "Owner Updated House"},
    )

    assert detail.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["name"] == "Owner Updated House"


@pytest.mark.parametrize("actor", ["admin", "staff"])
def test_elevated_principal_can_read_and_edit_any_project(
    owned_project: OwnedProject,
    actor: Literal["admin", "staff"],
) -> None:
    client = _elevated_client(actor)
    detail = client.get(f"/api/v1/projects/{owned_project.project_id}")
    updated = client.patch(
        f"/api/v1/projects/{owned_project.project_id}",
        headers={"Origin": ORIGIN},
        json={"name": f"Updated by {actor}"},
    )

    assert detail.status_code == 200
    assert updated.status_code == 200


@pytest.mark.parametrize("actor", ["admin", "staff"])
def test_elevated_principal_cannot_delete_another_users_project(
    owned_project: OwnedProject,
    actor: Literal["admin", "staff"],
) -> None:
    response = _elevated_client(actor).post(
        f"/api/v1/projects/{owned_project.project_id}/delete",
        headers={"Origin": ORIGIN},
        json={"confirm": True},
    )

    assert response.status_code == 404
    assert response.json()["error_code"] == "project_not_found"


@pytest.mark.parametrize("actor", ["admin", "staff"])
def test_elevated_session_exposes_all_projects_capability(
    actor: Literal["admin", "staff"],
) -> None:
    session = _elevated_client(actor).get("/api/v1/auth/session")

    assert session.status_code == 200
    assert PROJECT_ACCESS_ALL in session.json()["capabilities"]


def test_anonymous_project_access_remains_read_only_and_redacted(
    owned_project: OwnedProject,
) -> None:
    anonymous = TestClient(app)
    detail = anonymous.get(f"/api/v1/projects/{owned_project.project_id}")
    updated = anonymous.patch(
        f"/api/v1/projects/{owned_project.project_id}",
        headers={"Origin": ORIGIN},
        json={"name": "Anonymous Update"},
    )

    assert detail.status_code == 200
    body = detail.json()
    assert body["client"] is None
    assert body["phius_dropbox_url"] is None
    assert body["owner_display_name"] is None
    assert body["access_mode"] == "viewer"
    assert updated.status_code == 401
    assert updated.json()["error_code"] == "not_authenticated"
