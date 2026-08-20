"""Executable contracts for Version management and human-readable diffs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from database import connection
from features.project_document import repository
from features.project_document.models import VersionPatchRequest
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from main import app
from tests.test_project_document import (
    ORIGIN,
    create_rooms_draft,
    draft_rooms_url,
    save_as_url,
    save_url,
    version_url,
)
from tests.test_projects import create_project, signed_in_client


def delete_version_url(project_id: object, version_id: object) -> str:
    return f"{version_url(project_id, version_id)}/delete"


def create_working_copy(
    client: TestClient,
    project_id: object,
    parent_version_id: object,
    name: str,
) -> dict[str, Any]:
    response = client.post(
        save_as_url(project_id, parent_version_id),
        headers={"Origin": ORIGIN},
        json={"name": name, "kind": "working", "locked": False},
    )
    assert response.status_code == 200
    return response.json()["version"]


@dataclass(frozen=True)
class VersionState:
    exists: bool
    child_parent_id: str | None
    draft_count: int


def version_state(version_id: object) -> VersionState:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT EXISTS(
                       SELECT 1 FROM project_versions WHERE id = %(version_id)s
                   ) AS version_exists,
                   (
                       SELECT parent_version_id
                       FROM project_versions
                       WHERE parent_version_id = %(version_id)s
                       ORDER BY id
                       LIMIT 1
                   ) AS child_parent_id,
                   (
                       SELECT count(*)
                       FROM project_version_drafts
                       WHERE version_id = %(version_id)s
                   ) AS draft_count
            """,
            {"version_id": version_id},
        ).fetchone()
    assert row is not None
    child_parent_id = row["child_parent_id"]
    return VersionState(
        exists=bool(row["version_exists"]),
        child_parent_id=str(child_parent_id) if child_parent_id is not None else None,
        draft_count=int(row["draft_count"]),
    )


def audit_details(action: str) -> dict[str, Any]:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT details
            FROM user_action_log
            WHERE action = %(action)s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"action": action},
        ).fetchone()
    assert row is not None
    return dict(row["details"])


def test_existing_patch_contract_accepts_explicit_false() -> None:
    payload = VersionPatchRequest(locked=False)

    assert payload.model_fields_set == {"locked"}
    assert payload.locked is False
    assert payload.make_active is None


def test_version_patch_contract_distinguishes_omitted_name_and_false_activation() -> None:
    renamed = VersionPatchRequest.model_validate({"name": "  Coordination  "})
    assert renamed.model_fields_set == {"name"}
    assert renamed.model_dump()["name"] == "Coordination"

    with pytest.raises(ValidationError):
        VersionPatchRequest.model_validate({"name": None})
    with pytest.raises(ValidationError):
        VersionPatchRequest(make_active=False)
    with pytest.raises(ValidationError):
        VersionPatchRequest()


def test_editor_can_rename_locked_version_and_duplicate_name_is_stable(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    original_id = project["active_version_id"]
    copy = create_working_copy(client, project_id, original_id, "Coordination")
    locked = client.patch(
        version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"locked": True},
    )
    assert locked.status_code == 200

    renamed = client.patch(
        version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"name": "  Existing Conditions  "},
    )

    assert renamed.status_code == 200
    body = renamed.json()
    renamed_version = next(version for version in body["versions"] if version["id"] == original_id)
    assert renamed_version["name"] == "Existing Conditions"
    assert renamed_version["locked"] is True
    details = audit_details("project_version_renamed")
    assert details["version_id"] == original_id
    assert details["old_name"] == "Working"
    assert details["new_name"] == "Existing Conditions"

    mixed = client.patch(
        version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"name": "Design Development", "locked": False, "make_active": True},
    )
    assert mixed.status_code == 200
    mixed_details = audit_details("project_version_patch")
    assert mixed_details == {
        "project_id": project_id,
        "version_id": original_id,
        "old_name": "Existing Conditions",
        "new_name": "Design Development",
        "old_locked": True,
        "new_locked": False,
        "old_active_version_id": copy["id"],
        "new_active_version_id": original_id,
    }

    duplicate = client.patch(
        version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"name": copy["name"]},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error_code"] == "version_name_taken"


def test_active_version_delete_is_blocked(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    original_id = project["active_version_id"]
    active = create_working_copy(client, project_id, original_id, "Active Working Copy")

    response = client.post(
        delete_version_url(project_id, active["id"]),
        headers={"Origin": ORIGIN},
        json={"confirm_name": active["name"]},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "active_version_delete_blocked"


def test_sole_version_delete_uses_last_version_guard(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)

    response = client.post(
        delete_version_url(project["id"], project["active_version_id"]),
        headers={"Origin": ORIGIN},
        json={"confirm_name": "Working"},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "last_version_delete_blocked"


def test_non_active_version_delete_discards_draft_and_detaches_child(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    parent_id = project["active_version_id"]
    child = create_working_copy(client, project_id, parent_id, "Child Version")
    create_rooms_draft(client, project_id, parent_id)
    assert version_state(parent_id) == VersionState(
        exists=True,
        child_parent_id=str(parent_id),
        draft_count=1,
    )

    deleted = client.post(
        delete_version_url(project_id, parent_id),
        headers={"Origin": ORIGIN},
        json={"confirm_name": "Working"},
    )

    assert deleted.status_code == 200
    assert deleted.json()["active_version_id"] == child["id"]
    assert version_state(parent_id) == VersionState(
        exists=False,
        child_parent_id=None,
        draft_count=0,
    )
    details = audit_details("project_version_deleted")
    assert details == {
        "project_id": project_id,
        "version_id": parent_id,
        "version_name": "Working",
        "version_kind": "working",
        "discarded_draft_count": 1,
        "detached_child_count": 1,
    }


def test_version_delete_confirmation_name_must_match_current_name(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    original_id = project["active_version_id"]
    create_working_copy(client, project_id, original_id, "Active Copy")

    response = client.post(
        delete_version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"confirm_name": "Stale Working Name"},
    )

    assert response.status_code == 409
    assert response.json()["error_code"] == "version_delete_confirmation_mismatch"
    assert version_state(original_id).exists is True


def test_locked_submitted_version_can_be_deleted(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    original_id = project["active_version_id"]
    submitted = client.post(
        save_as_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"name": "Round 1 Submit", "kind": "submitted", "locked": False},
    )
    assert submitted.status_code == 200
    submitted_version = submitted.json()["version"]
    assert submitted_version["locked"] is True
    create_working_copy(client, project_id, submitted_version["id"], "Coordination")

    deleted = client.post(
        delete_version_url(project_id, submitted_version["id"]),
        headers={"Origin": ORIGIN},
        json={"confirm_name": submitted_version["name"]},
    )

    assert deleted.status_code == 200
    assert all(version["id"] != submitted_version["id"] for version in deleted.json()["versions"])


def test_version_mutations_require_editor_access_and_project_membership(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    first = create_project(client, bt_number="VM-01")
    second = create_project(client, bt_number="VM-02")

    anonymous = TestClient(app)
    unauthenticated = anonymous.post(
        delete_version_url(first["id"], first["active_version_id"]),
        headers={"Origin": ORIGIN},
        json={"confirm_name": "Working"},
    )
    wrong_project = client.patch(
        version_url(first["id"], second["active_version_id"]),
        headers={"Origin": ORIGIN},
        json={"name": "Wrong Project"},
    )

    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["error_code"] == "not_authenticated"
    assert wrong_project.status_code == 404
    assert wrong_project.json()["error_code"] == "project_version_not_found"


def test_project_version_mutation_lock_helper_orders_project_before_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def lock_project(_conn: object, _project_id: object) -> dict[str, object]:
        calls.append("project")
        return {"id": _project_id}

    def lock_body(_conn: object, _project_id: object, _version_id: object) -> dict[str, object]:
        calls.append("body")
        return {"id": _version_id}

    def lock_metadata(_conn: object, _project_id: object, _version_id: object) -> dict[str, object]:
        calls.append("metadata")
        return {"id": _version_id}

    monkeypatch.setattr(repository, "lock_project_for_version_mutation", lock_project)
    monkeypatch.setattr(repository, "get_project_version_for_update", lock_body)
    monkeypatch.setattr(repository, "get_project_version_metadata_for_update", lock_metadata)
    project_id = uuid4()
    version_id = uuid4()

    repository.lock_project_and_version_for_mutation(
        cast(Any, object()),
        project_id,
        version_id,
        include_body=True,
    )
    assert calls == ["project", "body"]

    calls.clear()
    repository.lock_project_and_version_for_mutation(
        cast(Any, object()),
        project_id,
        version_id,
        include_body=False,
    )
    assert calls == ["project", "metadata"]


class RecordingResult:
    def fetchone(self) -> dict[str, object]:
        return {"id": uuid4(), "active_version_id": uuid4()}

    def fetchall(self) -> list[dict[str, object]]:
        return []


class RecordingConnection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def execute(self, query: str, _params: object) -> RecordingResult:
        self.statements.append(query)
        return RecordingResult()


def test_project_version_mutation_repository_queries_lock_rows() -> None:
    conn = RecordingConnection()
    project_id = uuid4()
    version_id = uuid4()

    repository.lock_project_for_version_mutation(cast(Any, conn), project_id)
    repository.get_project_version_for_update(cast(Any, conn), project_id, version_id)
    repository.get_project_version_metadata_for_update(cast(Any, conn), project_id, version_id)
    repository.list_project_versions_for_update(cast(Any, conn), project_id)

    assert len(conn.statements) == 4
    assert all("FOR UPDATE" in statement for statement in conn.statements)
    assert "ORDER BY id" in conn.statements[-1]


def test_mixed_project_version_mutations_use_shared_lock_boundary(
    clean_document_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    original_id = project["active_version_id"]
    create_rooms_draft(client, project_id, original_id)
    draft = client.get(draft_rooms_url(project_id, original_id)).json()

    calls: list[str] = []
    lock_pair = repository.lock_project_and_version_for_mutation
    lock_project = repository.lock_project_for_version_mutation
    lock_versions = repository.list_project_versions_for_update

    def record_pair(*args: Any, **kwargs: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        calls.append("project-version")
        return lock_pair(*args, **kwargs)

    def record_project(*args: Any, **kwargs: Any) -> dict[str, Any] | None:
        calls.append("project")
        return lock_project(*args, **kwargs)

    def record_versions(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        calls.append("versions")
        return lock_versions(*args, **kwargs)

    monkeypatch.setattr(repository, "lock_project_and_version_for_mutation", record_pair)
    monkeypatch.setattr(repository, "lock_project_for_version_mutation", record_project)
    monkeypatch.setattr(repository, "list_project_versions_for_update", record_versions)

    saved = client.post(
        save_url(project_id, original_id),
        headers={"Origin": ORIGIN, "If-Match": draft["version_etag"]},
    )
    assert saved.status_code == 200
    assert calls[0] == "project-version"

    calls.clear()
    copy = create_working_copy(client, project_id, original_id, "Lock Order Copy")
    assert calls[0] == "project-version"

    calls.clear()
    activated = client.patch(
        version_url(project_id, original_id),
        headers={"Origin": ORIGIN},
        json={"make_active": True},
    )
    assert activated.status_code == 200
    assert calls[0] == "project-version"

    calls.clear()
    deleted = client.post(
        delete_version_url(project_id, copy["id"]),
        headers={"Origin": ORIGIN},
        json={"confirm_name": copy["name"]},
    )
    assert deleted.status_code == 200
    assert calls[:2] == ["project", "versions"]


def rooms_diff_fixture() -> tuple[dict[str, Any], dict[str, Any]]:
    field_defs = [field.model_dump(mode="json") for field in ROOMS_BUILT_IN_FIELD_DEFS]
    field_defs.append(
        {
            "field_key": "cf_finish",
            "display_name": "Finish",
            "field_type": "short_text",
            "config": {},
            "description": None,
            "default": None,
            "origin": "custom",
            "created_at": "2026-08-19T12:00:00Z",
            "created_by": None,
        }
    )
    before = {
        "field_defs": field_defs,
        "rows": [
            {
                "id": "rm_living",
                "custom_values": {
                    "number": "101",
                    "name": "Living Room",
                    "ceiling_height_m": 2.5,
                    "cf_finish": "Primer",
                },
            }
        ],
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Ground", "color": "#3b82f6", "order": 0}]
        },
    }
    after = {
        **before,
        "rows": [
            {
                "id": "rm_living",
                "custom_values": {
                    "number": "101",
                    "name": "Living Room",
                    "ceiling_height_m": 2.6,
                    "cf_finish": "Painted",
                },
            },
            {
                "id": "rm_bedroom",
                "custom_values": {"number": "102", "name": "Bedroom"},
            },
        ],
        "single_select_options": {
            "rooms.floor_level": [{"id": "opt_ground", "label": "Grade", "color": "#3b82f6", "order": 0}]
        },
    }
    return before, after


def test_structured_diff_resolves_builtin_custom_and_option_labels() -> None:
    from features.project_document.diff import table_diff_summary

    before, after = rooms_diff_fixture()
    summary = table_diff_summary("rooms", before, after).model_dump(mode="json")

    assert summary["table_label"] == "Rooms"
    assert summary["added_count"] == 1
    assert summary["removed_count"] == 0
    assert summary["changed_count"] == 3
    assert summary["change_count"] == len(summary["changed_paths"])
    changes = {(change["operation"], change["record_id"], change["field_key"]): change for change in summary["changes"]}
    ceiling_height = changes[("changed", "rm_living", "ceiling_height_m")]
    assert ceiling_height == {
        "operation": "changed",
        "record_id": "rm_living",
        "record_label": "Living Room",
        "field_key": "ceiling_height_m",
        "field_label": "Ceiling Height",
        "before": 2.5,
        "after": 2.6,
        "raw_paths": ["rooms.rows[rm_living].custom_values.ceiling_height_m"],
    }
    assert changes[("changed", "rm_living", "cf_finish")]["field_label"] == "Finish"
    assert changes[("added", "rm_bedroom", None)]["record_label"] == "Bedroom"
    assert changes[("changed", "opt_ground", "label")]["field_label"] == "Label"


@pytest.mark.parametrize(
    ("table", "before", "after", "expected"),
    [
        (
            "project_materials",
            [
                {
                    "id": "pmat_rockwool",
                    "name": "Roxul SmartRock",
                    "conductivity_w_mk": 0.036,
                    "pdf_report_asset_ids": ["asset_old"],
                }
            ],
            [
                {
                    "id": "pmat_rockwool",
                    "name": "Roxul SmartRock",
                    "conductivity_w_mk": 0.034,
                    "pdf_report_asset_ids": ["asset_old", "asset_new"],
                }
            ],
            {
                "record_label": "Roxul SmartRock",
                "field_keys": {"conductivity_w_mk", "pdf_report_asset_ids"},
            },
        ),
        (
            "apertures",
            [
                {
                    "id": "apt_living",
                    "name": "Living Room Window",
                    "elements": [
                        {
                            "id": "aptel_main",
                            "name": "Main Sash",
                            "frames": {"top": "pfrm_old"},
                        }
                    ],
                }
            ],
            [
                {
                    "id": "apt_living",
                    "name": "Living Room Window",
                    "elements": [
                        {
                            "id": "aptel_main",
                            "name": "Main Sash",
                            "frames": {"top": "pfrm_new"},
                        }
                    ],
                }
            ],
            {
                "record_label": "Living Room Window",
                "field_keys": {"elements.aptel_main.frames.top"},
            },
        ),
    ],
)
def test_structured_diff_preserves_complex_values_and_nested_records(
    table: str,
    before: object,
    after: object,
    expected: dict[str, object],
) -> None:
    from features.project_document.diff import table_diff_summary

    summary = table_diff_summary(table, before, after).model_dump(mode="json")

    assert summary["table"] == table
    assert summary["change_count"] == len(summary["changed_paths"])
    assert summary["changes"]
    assert {change["record_label"] for change in summary["changes"]} == {expected["record_label"]}
    assert {change["field_key"] for change in summary["changes"]} == expected["field_keys"]
    assert all(change["raw_paths"] for change in summary["changes"])


@pytest.mark.parametrize(
    ("before_elements", "after_elements", "operation"),
    [([], [{"id": "sash", "name": "Sash"}], "added"), ([{"id": "sash", "name": "Sash"}], [], "removed")],
)
def test_structured_diff_classifies_nested_record_additions_and_removals(
    before_elements: list[dict[str, str]],
    after_elements: list[dict[str, str]],
    operation: str,
) -> None:
    from features.project_document.diff import table_diff_summary

    before = [{"id": "window", "name": "Window", "elements": before_elements}]
    after = [{"id": "window", "name": "Window", "elements": after_elements}]

    summary = table_diff_summary("apertures", before, after).model_dump(mode="json")

    assert summary[f"{operation}_count"] == 1
    assert summary["changes"] == [
        {
            "operation": operation,
            "record_id": "sash",
            "record_label": "Sash",
            "field_key": None,
            "field_label": None,
            "before": {"id": "sash", "name": "Sash"} if operation == "removed" else None,
            "after": {"id": "sash", "name": "Sash"} if operation == "added" else None,
            "raw_paths": ["apertures[window].elements[sash]"],
        }
    ]


def test_structured_diff_does_not_present_derived_only_changes() -> None:
    from features.project_document.diff import table_diff_summary

    before = [{"id": "room", "computed": {"area": 1.0}}]
    after = [{"id": "room", "computed": {"area": 2.0}}]

    summary = table_diff_summary("rooms", before, after)

    assert summary.changed_paths == ["rooms[room].computed.area"]
    assert summary.changes == []
    assert summary.added_count == summary.removed_count == summary.changed_count == 0


def test_diff_response_omits_unchanged_tables_and_keeps_raw_paths(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    current = client.get(draft_rooms_url(project_id, version_id)).json()
    payload = {
        "field_defs": current["field_defs"],
        "rooms": [
            {
                "id": "rm_living",
                "floor_level": None,
                "building_zone": None,
                "icfa_factor": 1.0,
                "catalog_origin": None,
                "notes": None,
                "custom_values": {"number": "101", "name": "Living Room"},
            }
        ],
        "single_select_options": current["single_select_options"],
    }
    written = client.put(
        draft_rooms_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": current["version_etag"]},
        json=payload,
    )
    assert written.status_code == 200

    response = client.get(f"/api/v1/projects/{project_id}/diff?from={version_id}&to=draft")

    assert response.status_code == 200
    body = response.json()
    assert [table["table"] for table in body["tables"]] == ["rooms"]
    rooms = body["tables"][0]
    assert rooms["table_label"] == "Rooms"
    assert rooms["added_count"] == 1
    assert rooms["removed_count"] == 0
    assert rooms["changed_count"] == 0
    assert rooms["changes"][0]["operation"] == "added"
    assert rooms["changes"][0]["record_label"] == "Living Room"
    assert rooms["changes"][0]["after"]["id"] == "rm_living"
    assert rooms["changes"][0]["raw_paths"]
