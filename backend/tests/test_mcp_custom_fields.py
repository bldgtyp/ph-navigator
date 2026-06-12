"""Plan-15 P2.3 — MCP `*_custom_field` write tool contract tests.

End-to-end coverage via the streamable HTTP transport: every tool
round-trips a valid mutation, scope gating rejects viewer tokens,
audit-log rows include `updated_via='mcp'`, and structured-error
codes carry the recoverability values pinned in the Phase-2 ADR.

All MCP transport interactions live in **one** `pytest.mark.asyncio`
function because the test builds a **fresh** `FastMCP` instance
(`build_mcp_server()`) and `StreamableHTTPSessionManager.run()` is
single-shot per instance. The fresh instance is isolated from the
module-level `phn_mcp` consumed by `test_mcp.py`, so the two MCP
test files coexist cleanly in the same pytest run.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.mcp.server import build_mcp_server
from main import app
from tests.project_document_helpers import custom_fields_from_slice as _custom_fields
from tests.project_document_helpers import field_defs_fingerprint as _fingerprint

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_mcp_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, mcp_tokens, project_status_items,
                     project_version_drafts, project_versions, project_location, projects, users
            RESTART IDENTITY CASCADE
            """
        )
    yield
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, mcp_tokens, project_status_items,
                     project_version_drafts, project_versions, project_location, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def _signed_in_client() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


def _create_project(client: TestClient, *, bt_number: str = "2426") -> dict[str, Any]:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": f"Project {bt_number}",
            "bt_number": bt_number,
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _issue_token(client: TestClient, project_id: str, *, scopes: list[str]) -> str:
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "P2.3 tests", "scopes": scopes},
    )
    assert issued.status_code == 201, issued.text
    return issued.json()["token"]


def _new_field_payload(
    cf_id: str = "cf_mcp",
    display_name: str = "Notes",
    field_type: str = "short_text",
    description: str | None = None,
) -> dict[str, Any]:
    return {
        "field_key": cf_id,
        "display_name": display_name,
        "field_type": field_type,
        "config": {},
        "description": description,
        "created_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "created_by": None,
    }


def _draft_rooms_url(project_id: str, version_id: str) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"


def _tool_text(result: Any) -> str:
    if result.content and isinstance(result.content[0], TextContent):
        return result.content[0].text
    return ""


def _tool_error_payload(result: Any, tool_name: str) -> dict[str, Any]:
    raw = _tool_text(result)
    return json.loads(raw.removeprefix(f"Error executing tool {tool_name}: "))


@pytest.mark.asyncio
async def test_mcp_custom_field_tools_full_surface(clean_mcp_tables: None) -> None:
    """Single end-to-end pass over every Phase-2 MCP schema-mutation tool.

    Each phase below is what was originally a separate test; they are
    bundled here because `StreamableHTTPSessionManager.run()` is
    single-shot per FastMCP instance. We build a **fresh** server via
    `build_mcp_server()` to keep this test isolated from the
    module-level `phn_mcp` consumed by `test_mcp.py`.
    """
    rest_client = _signed_in_client()
    project = _create_project(rest_client)
    project_id = str(project["id"])
    version_id = str(project["active_version_id"])
    write_token = _issue_token(rest_client, project_id, scopes=["project:read", "project:write"])
    viewer_token = _issue_token(rest_client, project_id, scopes=["project:read"])

    fresh_mcp = build_mcp_server(allow_env_token=False)
    mcp_asgi_app = fresh_mcp.streamable_http_app()
    # The fresh MCP isn't mounted under `/mcp` on the main app, so the
    # streamable-HTTP transport lives at the root of `mcp_asgi_app`.
    mcp_url = "http://127.0.0.1:8000/"
    transport = httpx.ASGITransport(app=mcp_asgi_app)
    async with fresh_mcp.session_manager.run():
        # --- write-token session: cover the happy paths + audit + error codes
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
            headers={"Authorization": f"Bearer {write_token}"},
            timeout=20,
        ) as http_client:
            async with streamable_http_client(mcp_url, http_client=http_client) as (
                read,
                write,
                _,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()

                    # --- (1) add_custom_field round-trip + server stamps created_by
                    initial = rest_client.get(_draft_rooms_url(project_id, version_id))
                    fingerprint = _fingerprint(initial.json()["field_defs"])
                    add_result = await session.call_tool(
                        "add_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "after": _new_field_payload(cf_id="cf_mcp_notes", display_name="MCP Notes"),
                            "expected_schema_fingerprint": fingerprint,
                            "if_match_version": initial.json()["version_etag"],
                        },
                    )
                    assert add_result.isError is False, _tool_text(add_result)
                    added = json.loads(_tool_text(add_result))
                    assert added["field_key"] == "cf_mcp_notes"
                    assert added["display_name"] == "MCP Notes"
                    assert added["created_by"] is not None

                    refetched = rest_client.get(_draft_rooms_url(project_id, version_id))
                    assert [field["field_key"] for field in _custom_fields(refetched.json())] == ["cf_mcp_notes"]

                    # --- (2) stale-fingerprint reject → recoverability "refresh"
                    stale = await session.call_tool(
                        "add_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "after": _new_field_payload(cf_id="cf_x"),
                            "expected_schema_fingerprint": "stale-fingerprint",
                            "if_match": refetched.json()["draft_etag"],
                        },
                    )
                    assert stale.isError is True
                    stale_payload = _tool_error_payload(stale, "add_custom_field")
                    assert stale_payload["code"] == "custom_field_stale_schema_fingerprint"
                    assert stale_payload["recoverability"] == "refresh"
                    assert stale_payload["details"]["expected_fingerprint"] == "stale-fingerprint"

                    # --- (3) duplicate-name reject → recoverability "fatal"
                    fp_after_add = _fingerprint(refetched.json()["field_defs"])
                    dup_name = await session.call_tool(
                        "add_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "after": _new_field_payload(
                                cf_id="cf_dup_name",
                                display_name="Number",  # collides w/ core
                            ),
                            "expected_schema_fingerprint": fp_after_add,
                            "if_match": refetched.json()["draft_etag"],
                        },
                    )
                    assert dup_name.isError is True
                    dup_payload = _tool_error_payload(dup_name, "add_custom_field")
                    assert dup_payload["code"] == "custom_field_duplicate_name"
                    assert dup_payload["recoverability"] == "fatal"
                    assert dup_payload["details"]["colliding_field_origin"] == "built_in"

                    # --- (4) rename round-trip preserves cf_id
                    rename_result = await session.call_tool(
                        "rename_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "field_id": "cf_mcp_notes",
                            "display_name": "MCP Notes (renamed)",
                            "expected_schema_fingerprint": fp_after_add,
                            "if_match": refetched.json()["draft_etag"],
                        },
                    )
                    assert rename_result.isError is False, _tool_text(rename_result)
                    renamed = json.loads(_tool_text(rename_result))
                    assert renamed["field_key"] == "cf_mcp_notes"
                    assert renamed["display_name"] == "MCP Notes (renamed)"

                    # --- (5) set_custom_field_description round-trip
                    after_rename = rest_client.get(_draft_rooms_url(project_id, version_id))
                    desc_result = await session.call_tool(
                        "set_custom_field_description",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "field_id": "cf_mcp_notes",
                            "description": "Set via MCP.",
                            "expected_schema_fingerprint": _fingerprint(after_rename.json()["field_defs"]),
                            "if_match": after_rename.json()["draft_etag"],
                        },
                    )
                    assert desc_result.isError is False, _tool_text(desc_result)
                    desc_returned = json.loads(_tool_text(desc_result))
                    assert desc_returned["description"] == "Set via MCP."

                    # --- (6) duplicate creates independent def
                    after_desc = rest_client.get(_draft_rooms_url(project_id, version_id))
                    dup_result = await session.call_tool(
                        "duplicate_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "source_field_id": "cf_mcp_notes",
                            "after": _new_field_payload(
                                cf_id="cf_mcp_notes_dup",
                                display_name="MCP Notes (renamed) copy",
                                description="Set via MCP.",
                            ),
                            "expected_schema_fingerprint": _fingerprint(after_desc.json()["field_defs"]),
                            "if_match": after_desc.json()["draft_etag"],
                        },
                    )
                    assert dup_result.isError is False, _tool_text(dup_result)
                    duplicated = json.loads(_tool_text(dup_result))
                    assert duplicated["field_key"] == "cf_mcp_notes_dup"

                    # --- (7) populate a row with a value for the duplicated field,
                    #          then delete_custom_field returns cleared_row_count = 1
                    after_dup = rest_client.get(_draft_rooms_url(project_id, version_id))
                    populated = rest_client.put(
                        _draft_rooms_url(project_id, version_id),
                        headers={"Origin": ORIGIN, "If-Match": after_dup.json()["draft_etag"]},
                        json={
                            "rooms": [
                                {
                                    "id": "rm_one",
                                    "floor_level": "opt_g",
                                    "building_zone": None,
                                    "icfa_factor": 1.0,
                                    "catalog_origin": None,
                                    "notes": None,
                                    "custom_values": {
                                        "number": "101",
                                        "name": "Room One",
                                        "num_people": 1,
                                        "num_bedrooms": 0,
                                        "cf_mcp_notes_dup": "value-to-clear",
                                    },
                                }
                            ],
                            "single_select_options": {
                                "rooms.floor_level": [{"id": "opt_g", "label": "G", "color": "#aaaaaa", "order": 0}],
                                "rooms.building_zone": [],
                            },
                            "field_defs": after_dup.json()["field_defs"],
                        },
                    )
                    assert populated.status_code == 200, populated.text

                    delete_result = await session.call_tool(
                        "delete_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "field_id": "cf_mcp_notes_dup",
                            "expected_schema_fingerprint": _fingerprint(populated.json()["field_defs"]),
                            "if_match": populated.json()["draft_etag"],
                        },
                    )
                    assert delete_result.isError is False, _tool_text(delete_result)
                    deleted = json.loads(_tool_text(delete_result))
                    assert deleted == {
                        "removed_field_id": "cf_mcp_notes_dup",
                        "cleared_row_count": 1,
                    }

        # --- viewer-token session: scope gate
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
            headers={"Authorization": f"Bearer {viewer_token}"},
            timeout=20,
        ) as viewer_client:
            async with streamable_http_client(mcp_url, http_client=viewer_client) as (
                read,
                write,
                _,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    fresh = rest_client.get(_draft_rooms_url(project_id, version_id))
                    scope_result = await session.call_tool(
                        "add_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "after": _new_field_payload(cf_id="cf_viewer_attempt"),
                            "expected_schema_fingerprint": _fingerprint(fresh.json()["field_defs"]),
                            "if_match": fresh.json()["draft_etag"],
                        },
                    )
                    assert scope_result.isError is True
                    scope_payload = _tool_error_payload(scope_result, "add_custom_field")
                    assert scope_payload["code"] == "mcp_scope_insufficient"
                    assert scope_payload["recoverability"] == "forbidden"

    # --- Audit log assertions outside the MCP context.
    # The first MCP add tagged the draft with `updated_via='mcp'` and
    # the audit row should reflect it. The REST seed in `_seed_field_via_rest`
    # was not used in this test (we used MCP-only adds), so all
    # `project_version_field_add` rows here originated from MCP.
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT details, ip_address, user_agent
            FROM user_action_log
            WHERE action = 'project_version_field_add'
            ORDER BY created_at ASC
            """
        ).fetchall()
    assert rows, "expected at least one MCP add audit row"
    add_row = rows[0]
    assert add_row["details"]["updated_via"] == "mcp"
    assert add_row["details"]["kind"] == "addField"
    assert add_row["details"]["field_id"] == "cf_mcp_notes"
    # MCP writes carry no FastAPI Request → IP / user-agent are NULL.
    assert add_row["ip_address"] is None
    assert add_row["user_agent"] is None
