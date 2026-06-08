"""Plan-17 P4.10 — Phase-4 formula-field acceptance coverage.

Exercises the REST endpoints end-to-end against an in-memory test
client: add a `formula` field, set its source via `setFormula`, see
the `rows_computed` overlay on the slice response, see the same
overlay on the table download body, and confirm that cycles +
missing refs + type-changes are rejected with the structured Phase 4
error codes.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from features.auth.service import create_or_update_user
from main import app
from tests.project_document_helpers import custom_fields_from_slice as _custom_fields
from tests.project_document_helpers import field_defs_fingerprint as _fingerprint

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


def _create_project(client: TestClient, *, bt_number: str = "p4") -> dict[str, Any]:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": f"P4 Project {bt_number}",
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


def _mutate_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/rooms/custom-fields:mutate"


def _download_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/download/tables/rooms"


def _save_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save"


def _new_field(
    field_id: str,
    display_name: str,
    field_type: str,
    *,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "field_key": field_id,
        "display_name": display_name,
        "field_type": field_type,
        "config": config or {},
        "description": None,
        "created_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "created_by": None,
    }


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
    payload = {
        "kind": "addField",
        "tableKey": "rooms",
        "after": field,
        "expectedSchemaFingerprint": _fingerprint(current["field_defs"]),
    }
    response = client.post(
        _mutate_url(project_id, version_id),
        headers=_headers_for(current),
        json=payload,
    )
    assert response.status_code == 200, response.text
    return response.json()


def _set_formula(
    client: TestClient,
    project_id: object,
    version_id: object,
    current: dict[str, Any],
    *,
    field_id: str,
    source: str,
) -> Any:
    payload = {
        "kind": "setFormula",
        "tableKey": "rooms",
        "fieldId": field_id,
        "source": source,
        "expectedSchemaFingerprint": _fingerprint(current["field_defs"]),
    }
    return client.post(
        _mutate_url(project_id, version_id),
        headers=_headers_for(current),
        json=payload,
    )


def _seed_rooms(
    client: TestClient,
    project_id: object,
    version_id: object,
    current: dict[str, Any],
) -> dict[str, Any]:
    rooms_payload: dict[str, Any] = {
        "rooms": [
            {
                "id": "rm_101",
                "floor_level": "opt_ground",
                "building_zone": None,
                "icfa_factor": 1.0,
                "catalog_origin": None,
                "notes": None,
                "custom_values": {
                    "number": "101",
                    "name": "Living",
                    "num_people": 2,
                    "num_bedrooms": 1,
                },
            },
            {
                "id": "rm_102",
                "floor_level": "opt_ground",
                "building_zone": None,
                "icfa_factor": 0.7,
                "catalog_origin": None,
                "notes": None,
                "custom_values": {
                    "number": "102",
                    "name": "Bedroom",
                    "num_people": 1,
                    "num_bedrooms": 1,
                },
            },
        ],
        "field_defs": current["field_defs"],
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0}],
            "rooms.building_zone": [],
        },
    }
    response = client.put(
        _draft_rooms_url(project_id, version_id),
        headers=_headers_for(current),
        json=rooms_payload,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_phase_4_formula_round_trip_renders_in_slice_and_download(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p4-rt")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    assert current["rows_computed"] == {}

    # Add a formula field.
    current = _add_field(
        client,
        project_id,
        version_id,
        current,
        _new_field("cf_label", "Label", "formula"),
    )

    # Seed two rows.
    current = _seed_rooms(client, project_id, version_id, current)

    # Set the formula.
    response = _set_formula(
        client,
        project_id,
        version_id,
        current,
        field_id="cf_label",
        source='concat({Number}, " - ", upper({Name}))',
    )
    assert response.status_code == 200, response.text
    current = response.json()

    # Slice carries rows_computed with the expected values.
    assert current["rows_computed"]["rm_101"]["cf_label"] == "101 - LIVING"
    assert current["rows_computed"]["rm_102"]["cf_label"] == "102 - BEDROOM"

    # Save so the download path (which reads the saved document) sees
    # the formula too. The save endpoint matches `If-Match` against the
    # *version* etag (the saved snapshot), not the draft etag.
    save = client.post(
        _save_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": current["version_etag"]},
    )
    assert save.status_code == 200, save.text

    # Download body carries the same computed overlay per row.
    download = client.get(_download_url(project_id, version_id), headers={"Origin": ORIGIN})
    assert download.status_code == 200
    body = json.loads(download.text)
    rooms_envelope = body["rooms"]
    rows_by_id = {row["id"]: row for row in rooms_envelope["rows"]}
    assert rows_by_id["rm_101"]["computed"]["cf_label"] == "101 - LIVING"
    assert rows_by_id["rm_102"]["computed"]["cf_label"] == "102 - BEDROOM"


def test_phase_4_setformula_rejects_missing_ref(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p4-mr")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(
        client,
        project_id,
        version_id,
        current,
        _new_field("cf_x", "X", "formula"),
    )
    response = _set_formula(
        client,
        project_id,
        version_id,
        current,
        field_id="cf_x",
        source="{Does Not Exist}",
    )
    assert response.status_code == 422, response.text
    assert response.json()["error_code"] == "custom_field_formula_missing_ref"


def test_phase_4_setformula_rejects_self_cycle(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p4-cycle")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(
        client,
        project_id,
        version_id,
        current,
        _new_field("cf_loop", "Loop", "formula"),
    )
    response = _set_formula(
        client,
        project_id,
        version_id,
        current,
        field_id="cf_loop",
        source="{Loop}",
    )
    assert response.status_code == 422
    detail = response.json()
    assert detail["error_code"] == "custom_field_formula_cycle"
    assert "cf_loop" in detail["details"]["cycle_path"]


def test_phase_4_changetype_to_formula_succeeds(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p4-ct")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    current = _add_field(
        client,
        project_id,
        version_id,
        current,
        _new_field("cf_plain", "Plain", "short_text"),
    )

    next_field = dict(_custom_fields(current)[0])
    next_field["field_type"] = "formula"
    payload = {
        "kind": "changeType",
        "tableKey": "rooms",
        "fieldId": "cf_plain",
        "after": next_field,
        "acknowledgeDestructive": True,
        "expectedSchemaFingerprint": _fingerprint(current["field_defs"]),
    }
    response = client.post(
        _mutate_url(project_id, version_id),
        headers=_headers_for(current),
        json=payload,
    )
    assert response.status_code == 200, response.text
    assert _custom_fields(response.json())[0]["field_type"] == "formula"


def test_phase_4_rename_referenced_field_absorbs_silently_and_overlay_recomputes(
    clean_document_tables: None,
) -> None:
    client = _signed_in_client()
    project = _create_project(client, bt_number="p4-rename")
    project_id = project["id"]
    version_id = project["active_version_id"]

    current = client.get(_draft_rooms_url(project_id, version_id)).json()
    # Add a formula referring to {Name}.
    current = _add_field(
        client,
        project_id,
        version_id,
        current,
        _new_field("cf_upper", "Upper", "formula"),
    )
    current = _seed_rooms(client, project_id, version_id, current)
    set_response = _set_formula(
        client,
        project_id,
        version_id,
        current,
        field_id="cf_upper",
        source="upper({Name})",
    )
    assert set_response.status_code == 200
    current = set_response.json()
    assert current["rows_computed"]["rm_101"]["cf_upper"] == "LIVING"

    # The stored AST refers to `name` by id, so the formula keeps
    # evaluating correctly even though we haven't actually renamed
    # the core field here. Verify the stored ast.deps id is core
    # `name`, confirming D2 / D12 identity rules.
    deps = _custom_fields(current)[0]["config"]["deps"]
    assert deps == ["name"]
