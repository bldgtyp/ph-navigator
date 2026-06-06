"""MCP token and read-surface contract tests for TB-04b."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import cast

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError
from mcp.types import TextContent

from config import Settings
from database import connection, transaction
from features.auth.service import create_or_update_user
from features.mcp.server import mcp as phn_mcp
from features.mcp.service import authenticate_plaintext_token, project_access_for_token, require_token_scope
from features.mcp.tools import (
    tool_apply_envelope_command,
    tool_delete_project,
    tool_hard_delete_project,
    tool_list_envelope_assemblies,
    tool_query_unfinished_envelope_work,
    tool_restore_project,
)
from features.project_document.validation import document_etag
from main import app
from tests.envelope.test_envelope_document_contracts import envelope_body, write_saved_body

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


def room_payload(field_defs: list[dict[str, object]]) -> dict[str, object]:
    return {
        "field_defs": field_defs,
        "rooms": [
            {
                "id": "rm_living",
                "floor_level": "opt_ground",
                "building_zone": "opt_residential",
                "icfa_factor": 1.0,
                "erv_unit_ids": [],
                "catalog_origin": None,
                "notes": None,
                "custom_values": {
                    "number": "101",
                    "name": "Living Room",
                    "num_people": 2,
                    "num_bedrooms": 0,
                },
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
    project_id = cast(str, project["id"])

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
    project_id = cast(str, project["id"])

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
    project_id = cast(str, project["id"])

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
    project_id = cast(str, project["id"])
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


def test_mcp_project_write_tools_soft_delete_and_restore(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "MCP delete tests", "scopes": ["project:read", "project:write"]},
    )
    token = issued.json()["token"]
    monkeypatch.setenv("PHN_MCP_TOKEN", token)

    deleted_body = tool_delete_project(project_id, cast(Context, None), allow_env_token=True)
    assert deleted_body["mode"] == "soft"
    assert deleted_body["project_id"] == project_id
    gone = client.get(f"/api/v1/projects/{project_id}")
    assert gone.status_code == 410
    assert gone.json()["error_code"] == "project_deleted"

    restored_body = tool_restore_project(project_id, cast(Context, None), allow_env_token=True)
    assert restored_body["id"] == project_id
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 200


def test_mcp_envelope_read_reports_and_semantic_command_write(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Assembly Builder MCP", "scopes": ["project:read", "project:write"]},
    )
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])

    assemblies = tool_list_envelope_assemblies(project_id, version_id, cast(Context, None), allow_env_token=True)
    assembly_rows = cast(list[dict[str, object]], assemblies["assemblies"])
    assert assemblies["source"] == "version"
    assert assembly_rows[0]["name"] == "WALL-C3"

    unfinished = tool_query_unfinished_envelope_work(project_id, version_id, cast(Context, None), allow_env_token=True)
    assert unfinished["counts"] == {
        "missing_materials": 1,
        "missing_conductivity": 1,
        "missing_datasheets": 1,
        "missing_site_photos": 1,
        "unused_materials": 0,
        "catalog_drift": 0,
    }

    updated = tool_apply_envelope_command(
        project_id,
        version_id,
        {"kind": "rename_assembly", "assembly_id": "asm_wall_c3", "name": "WALL-C3 MCP"},
        cast(Context, None),
        allow_env_token=True,
        if_match_version=document_etag(saved_body),
    )
    updated_assemblies = cast(list[dict[str, object]], updated["assemblies"])
    assert updated["source"] == "draft"
    assert updated_assemblies[0]["name"] == "WALL-C3 MCP"

    with connection() as conn:
        draft = conn.execute(
            "SELECT updated_via FROM project_version_drafts WHERE version_id = %(version_id)s",
            {"version_id": version_id},
        ).fetchone()
        audit = conn.execute("SELECT details FROM user_action_log WHERE action = 'envelope_command'").fetchone()
    assert draft is not None
    assert draft["updated_via"] == "mcp"
    assert audit is not None
    assert audit["details"]["command_kind"] == "rename_assembly"

    with pytest.raises(ToolError, match="draft_etag_mismatch"):
        tool_apply_envelope_command(
            project_id,
            version_id,
            {"kind": "rename_assembly", "assembly_id": "asm_wall_c3", "name": "WALL-C3 stale"},
            cast(Context, None),
            allow_env_token=True,
            if_match="stale",
        )


class _FakeR2DeleteResult:
    deleted_object_count = 0
    failed_object_keys: list[str] = []


class _FakeR2Client:
    listed_prefixes: list[str]
    deleted_keys: list[str]

    def __init__(self) -> None:
        self.listed_prefixes = []
        self.deleted_keys = []

    def list_object_keys(self, prefix: str) -> list[str]:
        self.listed_prefixes.append(prefix)
        return []

    def delete_objects(self, object_keys: list[str]) -> _FakeR2DeleteResult:
        self.deleted_keys = list(object_keys)
        return _FakeR2DeleteResult()


def test_mcp_hard_delete_tool_uses_exact_confirmation_and_storage(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    project_name = cast(str, project["name"])
    bt_number = cast(str, project["bt_number"])
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "MCP hard delete", "scopes": ["project:read", "project:write"]},
    )
    fake_storage = _FakeR2Client()
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])
    monkeypatch.setattr("features.projects.service.R2Client", lambda _settings: fake_storage)

    result = tool_hard_delete_project(
        project_id,
        project_name,
        bt_number,
        cast(Context, None),
        allow_env_token=True,
    )

    assert result["deleted"] is True
    assert result["project_id"] == project_id
    assert fake_storage.listed_prefixes == [f"projects/{project_id}/assets/"]
    with connection() as conn:
        project_count = conn.execute("SELECT count(*) AS count FROM projects").fetchone()
    assert project_count == {"count": 0}


def test_mcp_transport_security_settings_include_deployed_hosts() -> None:
    deployed = Settings(
        mcp_issuer_url="https://ph-navigator-v2.onrender.com",
        mcp_resource_server_url="https://ph-navigator-v2.onrender.com/mcp",
        cors_origins="https://ph-navigator-v2.onrender.com,https://ph-navigator-v2-staging.onrender.com",
        mcp_allowed_hosts="ph-navigator-v2-staging.onrender.com",
        mcp_allowed_origins="https://ph-navigator-v2-staging.onrender.com",
        render_external_url="https://ph-navigator-v2-api-staging.onrender.com",
        render_external_hostname="ph-navigator-v2-api-staging.onrender.com",
    )

    assert "ph-navigator-v2.onrender.com" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-v2.onrender.com:*" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-v2-staging.onrender.com" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-v2-api-staging.onrender.com" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-v2-api-staging.onrender.com:*" in deployed.mcp_allowed_hosts_list
    assert "localhost:*" in deployed.mcp_allowed_hosts_list
    assert "https://ph-navigator-v2.onrender.com" in deployed.mcp_allowed_origins_list
    assert "https://ph-navigator-v2-staging.onrender.com" in deployed.mcp_allowed_origins_list


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
                    tool_names = {tool.name for tool in (await session.list_tools()).tools}
                    assert {
                        "list_envelope_assemblies",
                        "list_project_materials",
                        "query_unfinished_envelope_work",
                        "report_material_catalog_drift",
                        "report_missing_envelope_evidence",
                        "apply_envelope_command",
                    }.issubset(tool_names)

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
                        json=room_payload(initial.json()["field_defs"]),
                    )
                    assert updated.status_code == 200

                    draft_document_result = await session.call_tool(
                        "get_document",
                        {"project_id": project_id, "version_id": version_id},
                    )
                    assert draft_document_result.isError is False
                    draft_document = json.loads(tool_text(draft_document_result))
                    assert draft_document["source"] == "draft"
                    draft_room = draft_document["body"]["tables"]["rooms"]["rows"][0]
                    assert draft_room["custom_values"]["name"] == "Living Room"
                    assert draft_document["body"]["tables"]["rooms"]["field_defs"][0]["field_key"] == "record_id"

                    table_result = await session.call_tool(
                        "get_table",
                        {"project_id": project_id, "version_id": version_id, "table_name": "rooms"},
                    )
                    assert table_result.isError is False
                    table = json.loads(tool_text(table_result))
                    assert table["source"] == "draft"
                    # Rooms is field-def-capable, so `rows` carries the
                    # {field_defs, rows} envelope.
                    assert table["rows"]["rows"][0]["custom_values"]["name"] == "Living Room"
                    assert table["rows"]["field_defs"][0]["field_key"] == "record_id"

                    missing_table_result = await session.call_tool(
                        "get_table",
                        {"project_id": project_id, "version_id": version_id, "table_name": "nonexistent_table"},
                    )
                    assert missing_table_result.isError is True
                    missing_table_error = json.loads(
                        tool_text(missing_table_result).removeprefix("Error executing tool get_table: ")
                    )
                    assert missing_table_error["code"] == "document_table_not_found"
                    assert missing_table_error["details"]["supported_tables"] == ["rooms", "apertures"]

                    rejection = await session.call_tool(
                        "replace_table",
                        {"project_id": project_id, "version_id": version_id, "table_name": "rooms", "rows": []},
                    )
                    assert rejection.isError is True
                    rejection_text = tool_text(rejection)
    error_payload = json.loads(rejection_text.removeprefix("Error executing tool replace_table: "))
    assert error_payload["code"] == "mcp_scope_insufficient"
    assert error_payload["recoverability"] == "forbidden"
