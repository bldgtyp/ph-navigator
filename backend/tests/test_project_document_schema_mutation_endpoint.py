"""Plan-15 P2.2 — REST `POST .../custom-fields:mutate` contract.

End-to-end coverage for the new schema-mutation endpoint: round-trip
adds, ETag + fingerprint conflict paths, locked-version + Save-As
flow, the unsupported-in-phase-2 reject (`changeType`), and the
per-mutation audit-log row.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient

from database import connection
from features.auth.service import create_or_update_user
from features.project_document.custom_fields import CustomFieldDef, CustomFieldType
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


def _create_project(client: TestClient) -> dict[str, Any]:
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


def _draft_rooms_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms"


def _mutate_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms/custom-fields:mutate"


def _save_as_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save-as"


def _version_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}"


def _fingerprint(custom_fields: list[dict[str, Any]]) -> str:
    return compute_table_schema_fingerprint(
        ROOMS_CORE_FIELD_KEYS,
        [CustomFieldDef.model_validate(field) for field in custom_fields],
    )


def _new_field_payload(
    cf_id: str = "cf_phase2",
    display_name: str = "Notes",
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
) -> dict[str, Any]:
    return {
        "id": cf_id,
        "field_key": None,
        "display_name": display_name,
        "field_type": field_type.value,
        "config": {},
        "description": description,
        "created_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "created_by": None,
    }


def _add_field_mutation(
    *,
    fingerprint: str,
    field_payload: dict[str, Any],
    insert_after: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "kind": "addField",
        "table_key": "rooms",
        "after": field_payload,
        "expected_schema_fingerprint": fingerprint,
    }
    if insert_after is not None:
        body["insert_after_field_id"] = insert_after
    return body


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_post_schema_mutation_adds_field_round_trip(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    assert initial.status_code == 200
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    mutation = _add_field_mutation(
        fingerprint=fingerprint,
        field_payload=_new_field_payload(cf_id="cf_notes", display_name="Notes"),
    )
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=mutation,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert [field["id"] for field in body["custom_fields"]] == ["cf_notes"]
    # `created_by` was stamped by the server with the editor user id —
    # the client sent `None`.
    assert body["custom_fields"][0]["created_by"] is not None
    assert body["custom_fields"][0]["created_by"] != "None"

    # Re-fetching the draft returns the same envelope.
    refetch = client.get(_draft_rooms_url(project_id, version_id))
    assert refetch.status_code == 200
    assert [field["id"] for field in refetch.json()["custom_fields"]] == ["cf_notes"]


def test_post_schema_mutation_returns_409_on_stale_fingerprint(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    mutation = _add_field_mutation(
        fingerprint="not-a-real-fingerprint",
        field_payload=_new_field_payload(cf_id="cf_x"),
    )
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=mutation,
    )
    assert response.status_code == 409
    payload = response.json()
    assert payload["error_code"] == "custom_field_stale_schema_fingerprint"
    assert payload["details"]["expected_fingerprint"] == "not-a-real-fingerprint"
    assert payload["details"]["actual_fingerprint"]


def test_post_schema_mutation_returns_422_on_duplicate_name(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    # "Number" collides with the core "Number" display name.
    mutation = _add_field_mutation(
        fingerprint=_fingerprint(initial.json()["custom_fields"]),
        field_payload=_new_field_payload(cf_id="cf_x", display_name="Number"),
    )
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=mutation,
    )
    assert response.status_code == 422
    payload = response.json()
    assert payload["error_code"] == "custom_field_duplicate_name"
    assert payload["details"]["colliding_field_origin"] == "core"


def test_post_schema_mutation_returns_409_on_locked_version(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    # Save-As to a locked version so we can target it with the mutation.
    save_as = client.post(
        _save_as_url(project_id, version_id),
        headers={"Origin": ORIGIN},
        json={"name": "Locked snapshot", "kind": "snapshot", "locked": True},
    )
    assert save_as.status_code == 200
    locked_version_id = save_as.json()["version"]["id"]

    locked_initial = client.get(_draft_rooms_url(project_id, locked_version_id))
    assert locked_initial.status_code == 200

    mutation = _add_field_mutation(
        fingerprint=fingerprint,
        field_payload=_new_field_payload(cf_id="cf_blocked"),
    )
    response = client.post(
        _mutate_url(project_id, locked_version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": locked_initial.json()["version_etag"]},
        json=mutation,
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "version_locked"

    # Sibling check — Save-As back to the original (unlocked) version
    # and the same mutation succeeds; the locked version stays clean.
    success = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=_add_field_mutation(
            fingerprint=fingerprint,
            field_payload=_new_field_payload(cf_id="cf_unlocked"),
        ),
    )
    assert success.status_code == 200
    locked_after = client.get(_draft_rooms_url(project_id, locked_version_id))
    assert locked_after.json()["custom_fields"] == []


def test_post_schema_mutation_returns_409_on_stale_draft_etag(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    # Land a first mutation so a draft + etag exist.
    first = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=_add_field_mutation(
            fingerprint=fingerprint,
            field_payload=_new_field_payload(cf_id="cf_first"),
        ),
    )
    assert first.status_code == 200

    # Second mutation against a stale draft etag is rejected.
    stale = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": "stale-etag"},
        json=_add_field_mutation(
            fingerprint=_fingerprint(first.json()["custom_fields"]),
            field_payload=_new_field_payload(cf_id="cf_second", display_name="Second"),
        ),
    )
    assert stale.status_code == 409
    assert stale.json()["error_code"] == "draft_etag_mismatch"


def test_post_schema_mutation_change_type_clean_preflight_succeeds(
    clean_document_tables: None,
) -> None:
    """Phase 3: changeType is now supported. Clean preflight (no rows on
    the column) succeeds without acknowledge_destructive."""
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    added = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=_add_field_mutation(
            fingerprint=fingerprint,
            field_payload=_new_field_payload(cf_id="cf_a", display_name="A"),
        ),
    )
    assert added.status_code == 200

    new_fp = _fingerprint(added.json()["custom_fields"])
    change_type = {
        "kind": "changeType",
        "tableKey": "rooms",
        "fieldId": "cf_a",
        "after": _new_field_payload(cf_id="cf_a", display_name="A", field_type=CustomFieldType.number),
        "expectedSchemaFingerprint": new_fp,
    }
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": added.json()["draft_etag"]},
        json=change_type,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["custom_fields"][0]["field_type"] == "number"


def test_post_schema_mutation_emits_audit_log(clean_document_tables: None) -> None:
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=_add_field_mutation(
            fingerprint=_fingerprint(initial.json()["custom_fields"]),
            field_payload=_new_field_payload(cf_id="cf_logged", display_name="Logged"),
        ),
    )
    assert response.status_code == 200

    with connection() as conn:
        row = conn.execute(
            """
            SELECT action, details
            FROM user_action_log
            WHERE action = 'project_version_custom_field_add'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    assert row is not None
    details = row["details"]
    assert details["project_id"] == str(project_id)
    assert UUID(details["version_id"]) == UUID(str(version_id))
    assert details["kind"] == "addField"
    assert details["field_id"] == "cf_logged"
    assert details["display_name"] == "Logged"


# ---------------------------------------------------------------------------
# Phase 3 (plan-16) — editOptions + changeType endpoint coverage
# ---------------------------------------------------------------------------


def test_post_schema_mutation_add_single_select_with_initial_options(
    clean_document_tables: None,
) -> None:
    """Phase 3 P3.5: AddFieldMutation supports an atomic
    `initialOptions` payload for single_select fields. The response
    envelope includes the namespaced option list under
    `single_select_options["rooms.<cf_id>"]`."""
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    add = {
        "kind": "addField",
        "tableKey": "rooms",
        "after": _new_field_payload(
            cf_id="cf_status",
            display_name="Status",
            field_type=CustomFieldType.single_select,
        ),
        "initialOptions": [
            {"id": "opt_open", "label": "Open", "color": "#3b82f6", "order": 1},
            {"id": "opt_done", "label": "Done", "color": "#10b981", "order": 2},
        ],
        "expectedSchemaFingerprint": fingerprint,
    }
    response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["custom_fields"][0]["field_type"] == "single_select"
    assert body["single_select_options"]["rooms.cf_status"][0]["label"] == "Open"


def test_post_schema_mutation_edit_options_delete_cascade(
    clean_document_tables: None,
) -> None:
    """Phase 3 P3.2: EditOptionsMutation deletes cascade to row clears
    and the response carries the updated namespaced option list."""
    client = _signed_in_client()
    project = _create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(_draft_rooms_url(project_id, version_id))
    fingerprint = _fingerprint(initial.json()["custom_fields"])

    add_response = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={
            "kind": "addField",
            "tableKey": "rooms",
            "after": _new_field_payload(
                cf_id="cf_status",
                display_name="Status",
                field_type=CustomFieldType.single_select,
            ),
            "initialOptions": [
                {"id": "opt_open", "label": "Open", "color": "#3b82f6", "order": 1},
                {"id": "opt_done", "label": "Done", "color": "#10b981", "order": 2},
            ],
            "expectedSchemaFingerprint": fingerprint,
        },
    )
    assert add_response.status_code == 200, add_response.text

    edit = client.post(
        _mutate_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": add_response.json()["draft_etag"]},
        json={
            "kind": "editOptions",
            "tableKey": "rooms",
            "fieldId": "cf_status",
            "nextOptions": [
                {"id": "opt_done", "label": "Done renamed", "color": "#10b981", "order": 1},
                {"id": "opt_new", "label": "Brand new", "color": "#a16207", "order": 2},
            ],
            "expectedSchemaFingerprint": _fingerprint(add_response.json()["custom_fields"]),
        },
    )
    assert edit.status_code == 200, edit.text
    options = edit.json()["single_select_options"]["rooms.cf_status"]
    assert [opt["id"] for opt in options] == ["opt_done", "opt_new"]
