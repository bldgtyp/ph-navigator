"""MCP token and read-surface contract tests for TB-04b."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
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
    tool_diff_versions,
    tool_discard_draft,
    tool_get_table,
    tool_hard_delete_project,
    tool_list_envelope_assemblies,
    tool_preview_replace_table,
    tool_query_unfinished_envelope_work,
    tool_replace_table,
    tool_restore_project,
    tool_save_draft,
    tool_save_draft_as,
    tool_update_project,
)
from features.project_document.validation import document_etag
from main import app
from tests.envelope.test_envelope_document_contracts import envelope_body, write_saved_body
from tests.features.heat_pumps.test_heat_pumps import (
    HPIE_1,
    indoor_equip,
    outdoor_equip,
    seed_leaf_rows,
)
from tests.project_document_helpers import set_saved_version_schema

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


def create_project(client: TestClient, bt_number: str = "2426") -> dict[str, object]:
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


def create_rooms_draft(client: TestClient, project_id: object, version_id: object, *, name: str) -> dict[str, object]:
    draft_url = f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"
    initial = client.get(draft_url)
    assert initial.status_code == 200
    payload = room_payload(initial.json()["field_defs"])
    rooms = cast(list[dict[str, object]], payload["rooms"])
    rooms[0]["custom_values"] = {
        "number": "101",
        "name": name,
        "num_people": 2,
        "num_bedrooms": 0,
    }
    updated = client.put(
        draft_url,
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert updated.status_code == 200
    return updated.json()


def issue_mcp_token(client: TestClient, project_id: object, *, scopes: list[str]) -> str:
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "MCP draft lifecycle", "scopes": scopes},
    )
    assert issued.status_code == 201
    return cast(str, issued.json()["token"])


def draft_row(version_id: object) -> dict[str, object] | None:
    with connection() as conn:
        return conn.execute(
            """
            SELECT body, draft_etag
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()


def saved_room_name(version_id: object) -> str:
    rows = saved_room_rows(version_id)
    custom_values = cast(dict[str, object], rows[0]["custom_values"])
    return cast(str, custom_values["name"])


def saved_room_rows(version_id: object) -> list[dict[str, object]]:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
    assert row is not None
    return cast(list[dict[str, object]], row["body"]["tables"]["rooms"]["rows"])


def mcp_error(exc: ToolError) -> dict[str, object]:
    return cast(dict[str, object], json.loads(str(exc)))


def tool_text(result) -> str:
    if result.content and isinstance(result.content[0], TextContent):
        return result.content[0].text
    return ""


def documented_mcp_tool_names() -> set[str]:
    doc_path = Path(__file__).resolve().parents[2] / "context" / "mcp.md"
    lines = doc_path.read_text().splitlines()
    try:
        start = lines.index("<!-- mcp-tool-inventory:start -->")
        end = lines.index("<!-- mcp-tool-inventory:end -->")
    except ValueError as exc:
        raise AssertionError("context/mcp.md is missing the MCP tool inventory markers") from exc
    names: set[str] = set()
    for line in lines[start + 1 : end]:
        stripped = line.strip()
        if not stripped:
            continue
        assert stripped.startswith("- `") and stripped.endswith("`"), stripped
        names.add(stripped.removeprefix("- `").removesuffix("`"))
    assert len(names) == end - start - 1
    return names


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


def test_mcp_save_draft_commits_and_clears_token_owner_draft(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    draft = create_rooms_draft(client, project_id, version_id, name="Library")
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    saved = tool_save_draft(
        cast(str, project_id),
        cast(str, version_id),
        cast(Context, None),
        allow_env_token=True,
        if_match=cast(str, draft["version_etag"]),
    )

    assert str(saved.project_id) == project_id
    assert str(saved.version.id) == version_id
    assert saved_room_name(version_id) == "Library"
    assert draft_row(version_id) is None
    with connection() as conn:
        audit = conn.execute("SELECT details FROM user_action_log WHERE action = 'project_version_save'").fetchone()
    assert audit is not None
    assert audit["details"]["updated_via"] == "mcp"


def test_mcp_save_draft_maps_stale_if_match_and_preserves_draft(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id, name="Office")
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    with pytest.raises(ToolError) as exc_info:
        tool_save_draft(
            cast(str, project_id),
            cast(str, version_id),
            cast(Context, None),
            allow_env_token=True,
            if_match="stale",
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "version_etag_mismatch"
    assert error["recoverability"] == "refresh"
    assert draft_row(version_id) is not None


def test_mcp_save_draft_maps_locked_version_to_refreshable_error(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    draft = create_rooms_draft(client, project_id, version_id, name="Locked Draft")
    patch = client.patch(
        f"/api/v1/projects/{project_id}/versions/{version_id}",
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert patch.status_code == 200
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    with pytest.raises(ToolError) as exc_info:
        tool_save_draft(
            cast(str, project_id),
            cast(str, version_id),
            cast(Context, None),
            allow_env_token=True,
            if_match=cast(str, draft["version_etag"]),
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "version_locked"
    assert error["recoverability"] == "refresh"
    assert draft_row(version_id) is not None


def test_mcp_discard_draft_drops_draft_and_noops_when_missing(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(client, project_id, version_id, name="Temporary")
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    discarded = tool_discard_draft(
        cast(str, project_id), cast(str, version_id), cast(Context, None), allow_env_token=True
    )
    missing = tool_discard_draft(
        cast(str, project_id), cast(str, version_id), cast(Context, None), allow_env_token=True
    )

    assert discarded.discarded is True
    assert missing.discarded is False
    assert draft_row(version_id) is None
    assert saved_room_rows(version_id) == []


def test_mcp_save_draft_as_creates_active_version_and_clears_draft(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    create_rooms_draft(client, project_id, version_id, name="Round 1 Living")
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    saved_as = tool_save_draft_as(
        project_id,
        version_id,
        "Round 1 Submit",
        cast(Context, None),
        allow_env_token=True,
        kind="submitted",
    )

    new_version_id = str(saved_as.version.id)
    assert new_version_id != version_id
    assert saved_as.version.kind == "submitted"
    assert saved_as.version.locked is True
    assert draft_row(version_id) is None
    assert saved_room_name(new_version_id) == "Round 1 Living"
    detail = client.get(f"/api/v1/projects/{project_id}").json()
    assert detail["active_version_id"] == new_version_id


def test_mcp_save_draft_as_succeeds_from_locked_source(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    create_rooms_draft(client, project_id, version_id, name="Locked Source Draft")
    locked = client.patch(
        f"/api/v1/projects/{project_id}/versions/{version_id}",
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    copied = tool_save_draft_as(
        project_id,
        version_id,
        "Unlocked Copy",
        cast(Context, None),
        allow_env_token=True,
    )

    assert str(copied.version.id) != version_id
    assert copied.version.locked is False
    assert saved_room_name(copied.version.id) == "Locked Source Draft"


def test_mcp_save_draft_as_validation_failure_is_fatal(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    with pytest.raises(ToolError) as exc_info:
        tool_save_draft_as(project_id, version_id, "", cast(Context, None), allow_env_token=True)

    error = mcp_error(exc_info.value)
    assert error["code"] == "validation_error"
    assert error["recoverability"] == "fatal"


def test_mcp_update_project_patches_version_metadata_and_rejects_noop(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    updated = tool_update_project(
        project_id,
        version_id,
        cast(Context, None),
        allow_env_token=True,
        locked=True,
    )

    assert updated.active_version is not None
    assert str(updated.active_version.id) == version_id
    assert updated.active_version.locked is True
    with pytest.raises(ToolError) as exc_info:
        tool_update_project(project_id, version_id, cast(Context, None), allow_env_token=True)
    error = mcp_error(exc_info.value)
    assert error["code"] == "validation_error"
    assert error["recoverability"] == "fatal"


def test_mcp_diff_versions_reports_draft_table_delta(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    create_rooms_draft(client, project_id, version_id, name="Diff Target")
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, project_id, scopes=["project:read"]))

    diff = tool_diff_versions(project_id, version_id, "draft", cast(Context, None), allow_env_token=True)

    rooms_diff = diff.tables[0]
    assert rooms_diff.table == "rooms"
    assert rooms_diff.change_count > 0
    assert "rooms.rooms.rows[rm_living]" in rooms_diff.changed_paths


def test_mcp_save_draft_rechecks_revoked_token_at_commit(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    draft = create_rooms_draft(client, project_id, version_id, name="Revoked")
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Revoked commit token", "scopes": ["project:read", "project:write"]},
    )
    assert issued.status_code == 201
    token = issued.json()["token"]
    monkeypatch.setenv("PHN_MCP_TOKEN", token)
    revoke = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens/{issued.json()['token_record']['id']}/revoke",
        headers={"Origin": ORIGIN},
    )
    assert revoke.status_code == 200

    with pytest.raises(ToolError) as exc_info:
        tool_save_draft(
            cast(str, project_id),
            cast(str, version_id),
            cast(Context, None),
            allow_env_token=True,
            if_match=cast(str, draft["version_etag"]),
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "not_authenticated"
    assert error["recoverability"] == "reauthenticate"
    assert draft_row(version_id) is not None


def test_mcp_replace_table_full_loop_saves_flat_table_edit(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)
    initial_rows_payload = cast(dict[str, object], initial.rows)
    payload = room_payload(cast(list[dict[str, object]], initial_rows_payload["field_defs"]))

    replaced = tool_replace_table(
        project_id,
        version_id,
        "rooms",
        cast(Context, None),
        allow_env_token=True,
        rows=payload,
        base_version_etag=initial.version_body_etag,
    )
    tool_save_draft(
        project_id,
        version_id,
        cast(Context, None),
        allow_env_token=True,
        if_match=initial.version_body_etag,
    )

    assert replaced["source"] == "draft"
    assert replaced["draft_etag"] is not None
    replaced_rooms = cast(list[dict[str, object]], replaced["rooms"])
    replaced_custom_values = cast(dict[str, object], replaced_rooms[0]["custom_values"])
    assert replaced_custom_values["name"] == "Living Room"
    assert saved_room_name(version_id) == "Living Room"


def test_mcp_replace_table_maps_stale_draft_etag_and_preserves_draft(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)
    initial_rows_payload = cast(dict[str, object], initial.rows)
    payload = room_payload(cast(list[dict[str, object]], initial_rows_payload["field_defs"]))
    first = tool_replace_table(
        project_id,
        version_id,
        "rooms",
        cast(Context, None),
        allow_env_token=True,
        rows=payload,
        base_version_etag=initial.version_body_etag,
    )

    with pytest.raises(ToolError) as exc_info:
        tool_replace_table(
            project_id,
            version_id,
            "rooms",
            cast(Context, None),
            allow_env_token=True,
            rows=payload,
            draft_etag="stale",
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "draft_etag_mismatch"
    assert error["recoverability"] == "refresh"
    draft = draft_row(version_id)
    assert draft is not None
    assert draft["draft_etag"] == first["draft_etag"]


def test_mcp_replace_table_allows_semantic_table_browser_parity(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "apertures", cast(Context, None), allow_env_token=True)
    aperture_row = {
        "id": "apt_mcp",
        "name": "MCP Test Aperture",
        "row_heights_mm": [1200.0],
        "column_widths_mm": [1000.0],
        "elements": [
            {
                "id": "aptel_mcp",
                "name": "Fixed",
                "row_span": [0, 0],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing_id": None,
                "operation": None,
            }
        ],
    }

    replaced = tool_replace_table(
        project_id,
        version_id,
        "apertures",
        cast(Context, None),
        allow_env_token=True,
        rows=[aperture_row],
        base_version_etag=initial.version_body_etag,
    )

    assert cast(list[dict[str, object]], replaced["apertures"])[0]["id"] == "apt_mcp"
    assert replaced["source"] == "draft"


def test_mcp_replace_table_accepts_get_table_rows_envelope(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)
    rows_payload = cast(dict[str, object], initial.rows)
    room_row = cast(list[dict[str, object]], room_payload([])["rooms"])[0]
    room_row["floor_level"] = None
    room_row["building_zone"] = None
    rows_payload["rows"] = [room_row]

    replaced = tool_replace_table(
        project_id,
        version_id,
        "rooms",
        cast(Context, None),
        allow_env_token=True,
        rows=rows_payload,
        base_version_etag=initial.version_body_etag,
    )

    assert cast(list[dict[str, object]], replaced["rooms"])[0]["id"] == "rm_living"
    assert replaced["source"] == "draft"


def test_mcp_replace_table_validation_failure_is_fatal(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)

    with pytest.raises(ToolError) as exc_info:
        tool_replace_table(
            project_id,
            version_id,
            "rooms",
            cast(Context, None),
            allow_env_token=True,
            rows={"rooms": [], "field_defs": [], "single_select_options": {}, "unknown": True},
            base_version_etag=initial.version_body_etag,
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "validation_error"
    assert error["recoverability"] == "fatal"


def test_mcp_replace_table_rows_envelope_rejects_unknown_keys(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)
    rows_payload = cast(dict[str, object], initial.rows)
    rows_payload["rows"] = []
    rows_payload["unknown"] = True

    with pytest.raises(ToolError) as exc_info:
        tool_replace_table(
            project_id,
            version_id,
            "rooms",
            cast(Context, None),
            allow_env_token=True,
            rows=rows_payload,
            base_version_etag=initial.version_body_etag,
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "validation_error"
    assert cast(dict[str, object], error["details"])["unsupported_keys"] == ["unknown"]


def test_mcp_replace_table_locked_version_is_refreshable(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )
    initial = tool_get_table(project_id, version_id, "rooms", cast(Context, None), allow_env_token=True)
    patch = client.patch(
        f"/api/v1/projects/{project_id}/versions/{version_id}",
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert patch.status_code == 200
    initial_rows_payload = cast(dict[str, object], initial.rows)

    with pytest.raises(ToolError) as exc_info:
        tool_replace_table(
            project_id,
            version_id,
            "rooms",
            cast(Context, None),
            allow_env_token=True,
            rows=room_payload(cast(list[dict[str, object]], initial_rows_payload["field_defs"])),
            base_version_etag=initial.version_body_etag,
        )

    error = mcp_error(exc_info.value)
    assert error["code"] == "version_locked"
    assert error["recoverability"] == "refresh"


def test_mcp_preview_replace_table_reports_cascade_without_persisting(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    seed_leaf_rows(client, project_id, version_id, "heat_pumps_indoor_equip", "indoor_equip", [indoor_equip()])
    seed_leaf_rows(
        client,
        project_id,
        version_id,
        "heat_pumps_outdoor_equip",
        "outdoor_equip",
        [outdoor_equip(paired_indoor_equip_id=HPIE_1)],
    )
    draft = draft_row(version_id)
    assert draft is not None
    monkeypatch.setenv(
        "PHN_MCP_TOKEN",
        issue_mcp_token(client, project_id, scopes=["project:read", "project:write"]),
    )

    preview = tool_preview_replace_table(
        project_id,
        version_id,
        "heat_pumps_indoor_equip",
        cast(Context, None),
        allow_env_token=True,
        rows=[],
        draft_etag=cast(str, draft["draft_etag"]),
    )

    assert [ref.field for ref in preview.affected] == ["paired_indoor_equip_id"]
    refetched = tool_get_table(
        project_id,
        version_id,
        "heat_pumps_indoor_equip",
        cast(Context, None),
        allow_env_token=True,
    )
    refetched_rows_payload = cast(dict[str, object], refetched.rows)
    assert len(cast(list[dict[str, object]], refetched_rows_payload["rows"])) == 1


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
        mcp_issuer_url="https://api.ph-nav.com",
        mcp_resource_server_url="https://api.ph-nav.com/mcp",
        cors_origins="https://www.ph-nav.com,https://ph-nav.com",
        mcp_allowed_hosts="api.ph-nav.com",
        mcp_allowed_origins="https://www.ph-nav.com",
        render_external_url="https://ph-navigator-api.onrender.com",
        render_external_hostname="ph-navigator-api.onrender.com",
    )

    assert "api.ph-nav.com" in deployed.mcp_allowed_hosts_list
    assert "api.ph-nav.com:*" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-api.onrender.com" in deployed.mcp_allowed_hosts_list
    assert "ph-navigator-api.onrender.com:*" in deployed.mcp_allowed_hosts_list
    assert "localhost:*" in deployed.mcp_allowed_hosts_list
    assert "https://api.ph-nav.com" in deployed.mcp_allowed_origins_list
    assert "https://www.ph-nav.com" in deployed.mcp_allowed_origins_list
    assert "https://ph-nav.com" in deployed.mcp_allowed_origins_list


@pytest.mark.asyncio
async def test_mcp_read_tools_return_document_and_structured_write_rejection(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    set_saved_version_schema(version_id, 0)
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
                    assert tool_names == documented_mcp_tool_names()

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
                    assert saved_document["body"]["schema_version"] == 1

                    create_rooms_draft(client, project_id, version_id, name="Living Room")

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
