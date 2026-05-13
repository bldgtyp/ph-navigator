"""MCP token and read-surface contract tests for TB-04b."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.mcp.server import mcp as phn_mcp
from features.mcp.service import authenticate_plaintext_token, project_access_for_token, require_token_scope
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_mcp_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, mcp_tokens, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )
    yield
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, mcp_tokens, project_status_items,
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


def room_payload() -> dict[str, object]:
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


def tool_text(result) -> str:
    if result.content and isinstance(result.content[0], TextContent):
        return result.content[0].text
    return ""


def test_editor_can_issue_list_and_revoke_project_scoped_token(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]

    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Local Claude", "scopes": ["project:read"]},
    )

    assert issued.status_code == 201
    body = issued.json()
    assert body["token"].startswith("phn_mcp_")
    assert body["token_record"]["token_prefix"] == body["token"][:16]
    assert body["token_record"]["scopes"] == ["project:read"]

    tokens = client.get(f"/api/v1/projects/{project_id}/mcp-tokens")
    assert tokens.status_code == 200
    assert tokens.json()["tokens"][0]["label"] == "Local Claude"
    assert "token" not in tokens.json()["tokens"][0]

    revoke = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens/{body['token_record']['id']}/revoke",
        headers={"Origin": ORIGIN},
    )
    assert revoke.status_code == 200
    assert revoke.json()["revoked_at"] is not None
    assert authenticate_plaintext_token(body["token"]) is None

    with connection() as conn:
        actions = conn.execute(
            """
            SELECT action
            FROM user_action_log
            WHERE action IN ('mcp_token_issue', 'mcp_token_revoke')
            ORDER BY created_at ASC
            """
        ).fetchall()
    assert [row["action"] for row in actions] == ["mcp_token_issue", "mcp_token_revoke"]


def test_token_issue_rejects_past_expiration(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]

    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={
            "label": "Expired token",
            "scopes": ["project:read"],
            "expires_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        },
    )

    assert issued.status_code == 422
    assert issued.json()["error_code"] == "validation_error"


def test_token_issue_requires_project_read_scope(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]

    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Write only", "scopes": ["project:write"]},
    )

    assert issued.status_code == 422
    assert issued.json()["error_code"] == "validation_error"


def test_project_token_validates_scope_and_project_boundary(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    other = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "Other Project",
            "bt_number": "2427",
            "client": None,
            "cert_programs": [],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert other.status_code == 201

    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Read only", "scopes": ["project:read"]},
    )
    token = authenticate_plaintext_token(issued.json()["token"])
    assert token is not None

    access = project_access_for_token(token, token.project_id, "project:read")
    assert access.project.bt_number == "2426"

    with pytest.raises(PermissionError, match="mcp_scope_insufficient"):
        require_token_scope(token, token.project_id, "project:write")
    with pytest.raises(PermissionError, match="mcp_project_scope_mismatch"):
        require_token_scope(token, other.json()["id"], "project:read")


@pytest.mark.asyncio
async def test_mcp_read_tools_return_document_and_structured_write_rejection(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "MCP read tests", "scopes": ["project:read"]},
    )
    token = issued.json()["token"]

    transport = httpx.ASGITransport(app=app)
    async with phn_mcp.session_manager.run():
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        ) as http_client:
            async with streamable_http_client("http://127.0.0.1:8000/mcp/", http_client=http_client) as (
                read,
                write,
                _,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    listed = await session.call_tool("list_projects", {})
                    assert listed.isError is False
                    listed_project = json.loads(tool_text(listed))["projects"][0]
                    assert listed_project["id"] == project_id
                    assert "access_mode" not in listed_project

                    saved_document_result = await session.call_tool(
                        "get_document",
                        {"project_id": project_id, "version_id": version_id},
                    )
                    assert saved_document_result.isError is False
                    saved_document = json.loads(tool_text(saved_document_result))
                    assert saved_document["source"] == "version"
                    assert saved_document["draft_etag"] is None

                    draft_url = f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"
                    initial = client.get(draft_url)
                    assert initial.status_code == 200
                    updated = client.put(
                        draft_url,
                        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
                        json=room_payload(),
                    )
                    assert updated.status_code == 200

                    draft_document_result = await session.call_tool(
                        "get_document",
                        {"project_id": project_id, "version_id": version_id},
                    )
                    assert draft_document_result.isError is False
                    draft_document = json.loads(tool_text(draft_document_result))
                    assert draft_document["source"] == "draft"
                    assert draft_document["body"]["tables"]["rooms"][0]["name"] == "Living Room"

                    table_result = await session.call_tool(
                        "get_table",
                        {"project_id": project_id, "version_id": version_id, "table_name": "rooms"},
                    )
                    assert table_result.isError is False
                    table = json.loads(tool_text(table_result))
                    assert table["source"] == "draft"
                    assert table["rows"][0]["name"] == "Living Room"

                    rejection = await session.call_tool(
                        "replace_table",
                        {"project_id": project_id, "version_id": version_id, "table_name": "rooms", "rows": []},
                    )
                    assert rejection.isError is True
                    rejection_text = tool_text(rejection)
    error_payload = json.loads(rejection_text.removeprefix("Error executing tool replace_table: "))
    assert error_payload["code"] == "mcp_scope_insufficient"
    assert error_payload["recoverability"] == "forbidden"
