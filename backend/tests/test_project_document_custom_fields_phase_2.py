"""Plan-15 P2.8 — Phase-2 custom-field acceptance coverage.

These tests pin the plan-13 §5 / plan-15 P2.8 exit criteria across
REST, table-value writes, Save / Save As, audit rows, and REST/MCP
cross-talk for Rooms custom fields.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent

from database import connection
from features.auth.service import create_or_update_user
from features.mcp.server import build_mcp_server
from features.project_document.custom_fields import CustomFieldDef
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.rooms import ROOMS_CORE_FIELD_KEYS
from main import app

ORIGIN = "http://localhost:5173"


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
            "name": f"P2.8 Project {bt_number}",
            "bt_number": bt_number,
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _draft_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"


def _saved_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/rooms"


def _mutate_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms/custom-fields:mutate"


def _save_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save"


def _save_as_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save-as"


def _issue_token(client: TestClient, project_id: object, *, scopes: list[str]) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "P2.8 custom-field acceptance", "scopes": scopes},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["token"])


def _fingerprint(custom_fields: list[dict[str, Any]]) -> str:
    return compute_table_schema_fingerprint(
        ROOMS_CORE_FIELD_KEYS,
        [CustomFieldDef.model_validate(field) for field in custom_fields],
    )


def _new_field(
    field_id: str,
    display_name: str,
    field_type: str = "short_text",
    *,
    config: dict[str, object] | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    return {
        "id": field_id,
        "field_key": None,
        "display_name": display_name,
        "field_type": field_type,
        "config": config or {},
        "description": description,
        "created_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "created_by": None,
    }


def _add_mutation(
    *,
    fingerprint: str,
    field: dict[str, Any],
    insert_after_field_id: str | None = None,
) -> dict[str, Any]:
    mutation: dict[str, Any] = {
        # Browser WriteOps use lower-camel keys; this pins the REST
        # boundary accepts the frontend shape, not just MCP snake_case.
        "kind": "addField",
        "tableKey": "rooms",
        "after": field,
        "expectedSchemaFingerprint": fingerprint,
    }
    if insert_after_field_id is not None:
        mutation["insertAfterFieldId"] = insert_after_field_id
    return mutation


def _rename_mutation(*, fingerprint: str, field_id: str, display_name: str) -> dict[str, Any]:
    return {
        "kind": "renameField",
        "tableKey": "rooms",
        "fieldId": field_id,
        "displayName": display_name,
        "expectedSchemaFingerprint": fingerprint,
    }


def _delete_mutation(*, fingerprint: str, field_id: str) -> dict[str, Any]:
    return {
        "kind": "deleteField",
        "tableKey": "rooms",
        "fieldId": field_id,
        "clearValues": True,
        "expectedSchemaFingerprint": fingerprint,
    }


def _duplicate_mutation(
    *,
    fingerprint: str,
    source_field_id: str,
    field: dict[str, Any],
) -> dict[str, Any]:
    return {
        "kind": "duplicateField",
        "tableKey": "rooms",
        "sourceFieldId": source_field_id,
        "after": field,
        "expectedSchemaFingerprint": fingerprint,
    }


def _description_mutation(
    *,
    fingerprint: str,
    field_id: str,
    description: str | None,
) -> dict[str, Any]:
    return {
        "kind": "setDescription",
        "tableKey": "rooms",
        "fieldId": field_id,
        "description": description,
        "expectedSchemaFingerprint": fingerprint,
    }


def _room(room_id: str, number: str, custom: dict[str, object]) -> dict[str, Any]:
    return {
        "id": room_id,
        "number": number,
        "name": f"Room {number}",
        "floor_level": "opt_ground",
        "building_zone": None,
        "num_people": 1,
        "num_bedrooms": 0,
        "icfa_factor": 1.0,
        "erv_unit_ids": [],
        "catalog_origin": None,
        "notes": None,
        "custom": custom,
    }


def _rooms_payload(custom_fields: list[dict[str, Any]], rooms: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "rooms": rooms,
        "custom_fields": custom_fields,
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0}],
            "rooms.building_zone": [],
        },
    }


def _tool_text(result: Any) -> str:
    if result.content and isinstance(result.content[0], TextContent):
        return result.content[0].text
    return ""


def _headers_for(slice_body: dict[str, Any]) -> dict[str, str]:
    if slice_body["draft_etag"]:
        return {"Origin": ORIGIN, "If-Match": slice_body["draft_etag"]}
    return {"Origin": ORIGIN, "If-Match-Version": slice_body["version_etag"]}


def _add_field(
    client: TestClient,
    project_id: object,
    version_id: object,
    current: dict[str, Any],
    field: dict[str, Any],
) -> dict[str, Any]:
    response = client.post(
        _mutate_url(project_id, version_id),
        headers=_headers_for(current),
        json=_add_mutation(fingerprint=_fingerprint(current["custom_fields"]), field=field),
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_phase_2_adds_four_types_then_cell_writes_and_save_round_trip(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-types")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    for field in [
        _new_field("cf_short", "Short note", "short_text"),
        _new_field("cf_long", "Long note", "long_text"),
        _new_field("cf_number", "Target ACH50", "number", config={"precision": 1}),
        _new_field("cf_url", "Submittal URL", "url"),
    ]:
        current = _add_field(client, project_id, version_id, current, field)

    values: dict[str, object] = {
        "cf_short": "ok",
        "cf_long": "Line one\nLine two",
        "cf_number": 0.6,
        "cf_url": "https://example.com/submittal.pdf",
    }
    write = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["draft_etag"]},
        json=_rooms_payload(current["custom_fields"], [_room("rm_101", "101", values)]),
    )
    assert write.status_code == 200, write.text
    assert write.json()["rooms"][0]["custom"] == values

    saved = client.post(
        _save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": write.json()["version_etag"]},
    )
    assert saved.status_code == 200, saved.text

    persisted = client.get(_saved_rooms_url(project_id, version_id))
    assert persisted.status_code == 200
    body = persisted.json()
    assert [field["field_type"] for field in body["custom_fields"]] == [
        "short_text",
        "long_text",
        "number",
        "url",
    ]
    assert body["rooms"][0]["custom"] == values


def test_phase_2_duplicate_name_recovery_sequence(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-dups")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(client, project_id, version_id, current, _new_field("cf_notes", "Notes"))

    duplicate = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["draft_etag"]},
        json=_add_mutation(
            fingerprint=_fingerprint(current["custom_fields"]),
            field=_new_field("cf_notes_again", "Notes"),
        ),
    )
    assert duplicate.status_code == 422
    assert duplicate.json()["error_code"] == "custom_field_duplicate_name"

    renamed = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["draft_etag"]},
        json=_rename_mutation(
            fingerprint=_fingerprint(current["custom_fields"]),
            field_id="cf_notes",
            display_name="Notes 2",
        ),
    )
    assert renamed.status_code == 200, renamed.text

    retry = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": renamed.json()["draft_etag"]},
        json=_add_mutation(
            fingerprint=_fingerprint(renamed.json()["custom_fields"]),
            field=_new_field("cf_notes_retry", "Notes"),
        ),
    )
    assert retry.status_code == 200, retry.text
    assert [field["display_name"] for field in retry.json()["custom_fields"]] == ["Notes 2", "Notes"]


def test_phase_2_stale_fingerprint_reports_active_fingerprint(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-stale")
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id)).json()
    held_fingerprint = _fingerprint(initial["custom_fields"])
    first = _add_field(client, project_id, version_id, initial, _new_field("cf_first", "First"))

    stale = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": first["draft_etag"]},
        json=_add_mutation(
            fingerprint=held_fingerprint,
            field=_new_field("cf_second", "Second"),
        ),
    )
    assert stale.status_code == 409
    payload = stale.json()
    assert payload["error_code"] == "custom_field_stale_schema_fingerprint"
    assert payload["details"]["expected_fingerprint"] == held_fingerprint
    assert payload["details"]["actual_fingerprint"] == _fingerprint(first["custom_fields"])


def test_phase_2_locked_version_save_as_recovery(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-lock")
    project_id = project["id"]
    version_id = project["active_version_id"]

    locked = client.post(
        _save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Locked snapshot", "kind": "snapshot", "locked": True},
    )
    assert locked.status_code == 200, locked.text
    locked_version_id = locked.json()["version"]["id"]
    locked_initial = client.get(_draft_rooms_url(project_id, locked_version_id)).json()

    blocked = client.post(
        _mutate_url(project_id, locked_version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": locked_initial["version_etag"]},
        json=_add_mutation(
            fingerprint=_fingerprint(locked_initial["custom_fields"]),
            field=_new_field("cf_blocked", "Blocked"),
        ),
    )
    assert blocked.status_code == 409
    assert blocked.json()["error_code"] == "version_locked"

    unlocked = client.post(
        _save_as_url(project_id, locked_version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Editable copy", "kind": "working", "locked": False},
    )
    assert unlocked.status_code == 200, unlocked.text
    unlocked_version_id = unlocked.json()["version"]["id"]
    unlocked_initial = client.get(_draft_rooms_url(project_id, unlocked_version_id)).json()
    added = client.post(
        _mutate_url(project_id, unlocked_version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": unlocked_initial["version_etag"]},
        json=_add_mutation(
            fingerprint=_fingerprint(unlocked_initial["custom_fields"]),
            field=_new_field("cf_unlocked", "Unlocked"),
        ),
    )
    assert added.status_code == 200, added.text
    assert client.get(_saved_rooms_url(project_id, locked_version_id)).json()["custom_fields"] == []


def test_phase_2_delete_clears_values_and_persists_clean_rows(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-delete")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(client, project_id, version_id, current, _new_field("cf_notes", "Notes"))
    write = client.put(
        _draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["draft_etag"]},
        json=_rooms_payload(
            current["custom_fields"],
            [
                _room("rm_101", "101", {"cf_notes": "A"}),
                _room("rm_102", "102", {"cf_notes": "B"}),
                _room("rm_103", "103", {"cf_notes": "C"}),
            ],
        ),
    )
    assert write.status_code == 200, write.text

    deleted = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": write.json()["draft_etag"]},
        json=_delete_mutation(
            fingerprint=_fingerprint(write.json()["custom_fields"]),
            field_id="cf_notes",
        ),
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["custom_fields"] == []
    assert all("cf_notes" not in row["custom"] for row in deleted.json()["rooms"])

    with connection() as conn:
        audit = conn.execute(
            """
            SELECT details
            FROM user_action_log
            WHERE action = 'project_version_custom_field_delete'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    assert audit is not None
    assert audit["details"]["cleared_row_count"] == 3

    saved = client.post(
        _save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": deleted.json()["version_etag"]},
    )
    assert saved.status_code == 200, saved.text
    persisted = client.get(_saved_rooms_url(project_id, version_id)).json()
    assert persisted["custom_fields"] == []
    assert all(row["custom"] == {} for row in persisted["rooms"])


def test_phase_2_audit_log_covers_every_mutation_kind(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-audit")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(client, project_id, version_id, current, _new_field("cf_a", "A"))
    renamed = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["draft_etag"]},
        json=_rename_mutation(
            fingerprint=_fingerprint(current["custom_fields"]),
            field_id="cf_a",
            display_name="A renamed",
        ),
    ).json()
    described = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": renamed["draft_etag"]},
        json=_description_mutation(
            fingerprint=_fingerprint(renamed["custom_fields"]),
            field_id="cf_a",
            description="Phase 2 audit description",
        ),
    ).json()
    duplicated = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": described["draft_etag"]},
        json=_duplicate_mutation(
            fingerprint=_fingerprint(described["custom_fields"]),
            source_field_id="cf_a",
            field=_new_field("cf_a_copy", "A renamed copy", description="Phase 2 audit description"),
        ),
    ).json()
    deleted = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": duplicated["draft_etag"]},
        json=_delete_mutation(
            fingerprint=_fingerprint(duplicated["custom_fields"]),
            field_id="cf_a_copy",
        ),
    )
    assert deleted.status_code == 200, deleted.text

    with connection() as conn:
        rows = conn.execute(
            """
            SELECT action, details
            FROM user_action_log
            WHERE details->>'version_id' = %(version_id)s
              AND action LIKE 'project_version_custom_field_%%'
            ORDER BY created_at ASC
            """,
            {"version_id": str(UUID(str(version_id)))},
        ).fetchall()
    assert [row["action"] for row in rows] == [
        "project_version_custom_field_add",
        "project_version_custom_field_rename",
        "project_version_custom_field_set_description",
        "project_version_custom_field_duplicate",
        "project_version_custom_field_delete",
    ]
    assert [row["details"]["kind"] for row in rows] == [
        "addField",
        "renameField",
        "setDescription",
        "duplicateField",
        "deleteField",
    ]


@pytest.mark.asyncio
async def test_phase_2_rest_mcp_cross_talk(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p28-mcp")
    project_id = str(project["id"])
    version_id = str(project["active_version_id"])
    token = _issue_token(client, project_id, scopes=["project:read", "project:write"])

    initial = client.get(_draft_rooms_url(project_id, version_id)).json()
    rest_added = _add_field(client, project_id, version_id, initial, _new_field("cf_rest", "REST Notes"))

    fresh_mcp = build_mcp_server(allow_env_token=False)
    transport = httpx.ASGITransport(app=fresh_mcp.streamable_http_app())
    mcp_url = "http://127.0.0.1:8000/"
    async with fresh_mcp.session_manager.run():
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        ) as http_client:
            async with streamable_http_client(mcp_url, http_client=http_client) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    table = await session.call_tool(
                        "get_table",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_name": "rooms",
                        },
                    )
                    assert table.isError is False, _tool_text(table)
                    table_payload = json.loads(_tool_text(table))
                    assert table_payload["rows"]["custom_fields"][0]["id"] == "cf_rest"

                    renamed = await session.call_tool(
                        "rename_custom_field",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "table_key": "rooms",
                            "field_id": "cf_rest",
                            "display_name": "Renamed via MCP",
                            "expected_schema_fingerprint": _fingerprint(rest_added["custom_fields"]),
                            "if_match": rest_added["draft_etag"],
                        },
                    )
                    assert renamed.isError is False, _tool_text(renamed)

    via_rest = client.get(_draft_rooms_url(project_id, version_id))
    assert via_rest.status_code == 200
    assert via_rest.json()["custom_fields"][0]["display_name"] == "Renamed via MCP"
