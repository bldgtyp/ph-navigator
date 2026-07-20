"""Project glazing/frame documentation command and attachment tests."""

from __future__ import annotations

from typing import Any

from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag
from tests.builders.assets import insert_project_asset
from tests.envelope.test_envelope_commands_geometry import command_url
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    base_document,
    create_project,
    signed_in_client,
    write_saved_body,
)
from tests.test_project_document_aperture_entities import _frame_ref, _glazing_ref


def _draft_apertures_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/apertures"


def _asset_url(project_id: object, asset_id: str, suffix: str) -> str:
    return f"/api/v1/projects/{project_id}/assets/{asset_id}{suffix}"


def _aperture_body() -> ProjectDocumentV1:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_glazings"] = [
        _project_glazing("pglz_used", "Used glazing", record_id="rec00000000000001"),
        _project_glazing("pglz_unused", "Unused glazing", record_id="rec00000000000002"),
    ]
    raw["tables"]["project_frames"] = [
        _project_frame("pfrm_used", "Used frame", record_id="rec00000000000003"),
        _project_frame("pfrm_unused", "Unused frame", record_id="rec00000000000004"),
    ]
    raw["tables"]["apertures"] = [
        {
            "id": "apt_window",
            "name": "Window",
            "row_heights_mm": [1000.0],
            "column_widths_mm": [1000.0],
            "elements": [
                {
                    "id": "aptel_1",
                    "name": "Sash",
                    "row_span": [0, 0],
                    "column_span": [0, 0],
                    "frames": {
                        "top": "pfrm_used",
                        "right": "pfrm_used",
                        "bottom": "pfrm_used",
                        "left": "pfrm_used",
                    },
                    "glazing_id": "pglz_used",
                    "operation": None,
                }
            ],
        }
    ]
    return ProjectDocumentV1.model_validate(raw)


def _project_glazing(row_id: str, name: str, *, record_id: str, **overrides: Any) -> dict[str, Any]:
    row = {
        "id": row_id,
        **{key: value for key, value in _glazing_ref(record_id=record_id).items() if key != "datasheet_url"},
        "name": name,
        "specification_status": "needed",
        "datasheet_asset_ids": [],
    }
    row.update(overrides)
    return row


def _project_frame(row_id: str, name: str, *, record_id: str, **overrides: Any) -> dict[str, Any]:
    row = {
        "id": row_id,
        **{key: value for key, value in _frame_ref(record_id=record_id).items() if key != "datasheet_url"},
        "name": name,
        "specification_status": "needed",
        "datasheet_asset_ids": [],
    }
    row.update(overrides)
    return row


def test_project_glazing_and_frame_documentation_commands(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = _aperture_body()
    write_saved_body(version_id, saved_body)

    edited_glazing = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": document_etag(saved_body)},
        json={
            "command": {
                "kind": "update_project_glazing",
                "project_glazing_id": "pglz_used",
                "manufacturer": "Updated Glass Co",
                "specification_status": "needed",
                "datasheet_not_required": True,
                "photo_not_required": True,
                "comments": "Basis of design confirmed.",
            }
        },
    )
    assert edited_glazing.status_code == 200
    aperture_slice = client.get(_draft_apertures_url(project_id, version_id)).json()
    glazing = next(row for row in aperture_slice["project_glazings"] if row["id"] == "pglz_used")
    assert glazing["manufacturer"] == "Updated Glass Co"
    assert glazing["specification_status"] == "needed"
    assert glazing["datasheet_not_required"] is True
    assert glazing["photo_not_required"] is True
    assert glazing["catalog_origin"]["local_overrides"] == ["comments", "manufacturer"]

    edited_frame = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": edited_glazing.json()["draft_etag"]},
        json={
            "command": {
                "kind": "update_project_frame",
                "project_frame_id": "pfrm_used",
                "width_mm": 98.0,
                "specification_status": "needed",
                "datasheet_not_required": True,
                "photo_not_required": True,
            }
        },
    )
    assert edited_frame.status_code == 200
    aperture_slice = client.get(_draft_apertures_url(project_id, version_id)).json()
    frame = next(row for row in aperture_slice["project_frames"] if row["id"] == "pfrm_used")
    assert frame["width_mm"] == 98.0
    assert frame["specification_status"] == "needed"
    assert frame["datasheet_not_required"] is True
    assert frame["photo_not_required"] is True

    remove_used = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": edited_frame.json()["draft_etag"]},
        json={"command": {"kind": "remove_project_glazing", "project_glazing_id": "pglz_used"}},
    )
    assert remove_used.status_code == 409
    assert remove_used.json()["error_code"] == "project_glazing_in_use"

    removed_glazing = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": edited_frame.json()["draft_etag"]},
        json={"command": {"kind": "remove_project_glazing", "project_glazing_id": "pglz_unused"}},
    )
    assert removed_glazing.status_code == 200

    removed_frame = client.post(
        command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": removed_glazing.json()["draft_etag"]},
        json={"command": {"kind": "remove_project_frame", "project_frame_id": "pfrm_unused"}},
    )
    assert removed_frame.status_code == 200
    aperture_slice = client.get(_draft_apertures_url(project_id, version_id)).json()
    assert {row["id"] for row in aperture_slice["project_glazings"]} == {"pglz_used"}
    assert {row["id"] for row in aperture_slice["project_frames"]} == {"pfrm_used"}


def test_project_glazing_datasheet_asset_attach_updates_flat_table(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = _aperture_body()
    write_saved_body(version_id, saved_body)
    insert_project_asset(project_id=project_id, asset_id="asset_glazing_datasheet")
    initial = client.get(_draft_apertures_url(project_id, version_id)).json()

    attach = client.post(
        _asset_url(project_id, "asset_glazing_datasheet", "/attach"),
        headers={"Origin": ORIGIN},
        json={
            "version_id": version_id,
            "table_key": "project_glazings",
            "row_id": "pglz_used",
            "field_key": "datasheet_asset_ids",
            "if_match": initial["draft_etag"],
            "if_match_version": initial["version_etag"],
        },
    )
    assert attach.status_code == 200
    assert attach.json()["asset_ids"] == ["asset_glazing_datasheet"]

    aperture_slice = client.get(_draft_apertures_url(project_id, version_id)).json()
    glazing = next(row for row in aperture_slice["project_glazings"] if row["id"] == "pglz_used")
    assert glazing["datasheet_asset_ids"] == ["asset_glazing_datasheet"]
