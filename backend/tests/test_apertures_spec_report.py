"""Aperture product report backend contract tests."""

from __future__ import annotations

from typing import Any

from features.apertures.selectors import build_apertures_read_parts
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from tests.envelope.test_envelope_document_contracts import write_saved_body
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def _glazing(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "pglz_main",
        "name": "Triple clear",
        "manufacturer": "PH Glass",
        "brand": None,
        "suffix": None,
        "u_value_w_m2k": 0.62,
        "g_value": 0.51,
        "color": None,
        "source": None,
        "comments": None,
        "specification_status": "needed",
        "datasheet_asset_ids": [],
        "catalog_origin": None,
    }
    base.update(overrides)
    return base


def _frame(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "pfrm_main",
        "name": "Timber frame",
        "manufacturer": "PH Frames",
        "brand": None,
        "use": None,
        "operation": None,
        "location": None,
        "mull_type": None,
        "prefix": None,
        "suffix": None,
        "material": "wood",
        "width_mm": 92.0,
        "u_value_w_m2k": 0.84,
        "psi_g_w_mk": 0.035,
        "psi_install_w_mk": 0.018,
        "color": None,
        "source": None,
        "comments": None,
        "specification_status": "needed",
        "datasheet_asset_ids": [],
        "catalog_origin": None,
    }
    base.update(overrides)
    return base


def _aperture_body() -> ProjectDocumentV1:
    body = empty_project_document(
        CreateProjectRequest(name="West Stockbridge House", bt_number="2426", cert_programs=["phi"])
    )
    raw = body.model_dump(mode="json")
    raw["tables"]["project_glazings"] = [
        _glazing(),
        _glazing(id="pglz_unused", name="Unused glazing"),
    ]
    raw["tables"]["project_frames"] = [
        _frame(),
        _frame(id="pfrm_other", name="Side frame"),
        _frame(id="pfrm_unused", name="Unused frame"),
    ]
    raw["tables"]["apertures"] = [
        {
            "id": "apt_type_a",
            "name": "W1",
            "row_heights_mm": [1000.0],
            "column_widths_mm": [500.0, 500.0, 500.0],
            "elements": [
                {
                    "id": "aptel_a",
                    "name": "Left sash",
                    "row_span": [0, 0],
                    "column_span": [0, 0],
                    "frames": {
                        "top": "pfrm_main",
                        "right": "pfrm_main",
                        "bottom": "pfrm_main",
                        "left": "pfrm_main",
                    },
                    "glazing_id": "pglz_main",
                    "operation": None,
                },
                {
                    "id": "aptel_b",
                    "name": "Center fixed",
                    "row_span": [0, 0],
                    "column_span": [1, 1],
                    "frames": {
                        "top": "pfrm_other",
                        "right": "pfrm_other",
                        "bottom": "pfrm_other",
                        "left": "pfrm_other",
                    },
                    "glazing_id": "pglz_main",
                    "operation": None,
                },
                {
                    "id": "aptel_c",
                    "name": "Right sash",
                    "row_span": [0, 0],
                    "column_span": [2, 2],
                    "frames": {},
                    "glazing_id": "pglz_main",
                    "operation": None,
                },
            ],
        }
    ]
    return ProjectDocumentV1.model_validate(raw)


def _spec_report_url(project_id: object, version_id: object, source: str = "draft") -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/spec-report?source={source}"


def _envelope_command_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/envelope/commands"


def test_build_apertures_read_parts_derives_use_sites() -> None:
    glazings, frames = build_apertures_read_parts(_aperture_body())

    main_glazing = next(glazing for glazing in glazings if glazing.id == "pglz_main")
    assert [site.element_name for site in main_glazing.use_sites] == ["Left sash", "Center fixed", "Right sash"]
    assert next(glazing for glazing in glazings if glazing.id == "pglz_unused").use_sites == []

    main_frame = next(frame for frame in frames if frame.id == "pfrm_main")
    assert [site.side for site in main_frame.use_sites] == ["top", "right", "bottom", "left"]
    assert {site.aperture_type_name for site in main_frame.use_sites} == {"W1"}
    assert next(frame for frame in frames if frame.id == "pfrm_unused").use_sites == []


def test_aperture_spec_report_returns_saved_and_draft_sources(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = _aperture_body()
    write_saved_body(version_id, saved_body)

    saved = client.get(_spec_report_url(project_id, version_id, source="version"))
    assert saved.status_code == 200
    saved_json = saved.json()
    assert saved_json["source"] == "version"
    assert saved_json["draft_etag"] is None
    assert saved_json["project_glazings"][0]["use_sites"][0]["element_name"] == "Left sash"
    assert saved_json["project_frames"][0]["use_sites"][3]["side"] == "left"

    updated = client.post(
        _envelope_command_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": saved_json["version_etag"]},
        json={
            "command": {
                "kind": "update_project_glazing",
                "project_glazing_id": "pglz_main",
                "name": "Draft triple clear",
            }
        },
    )
    assert updated.status_code == 200

    draft = client.get(_spec_report_url(project_id, version_id, source="draft"))
    assert draft.status_code == 200
    draft_json = draft.json()
    assert draft_json["source"] == "draft"
    assert draft_json["draft_etag"]
    assert draft_json["project_glazings"][0]["name"] == "Draft triple clear"
    assert draft_json["version_etag"] == document_etag(saved_body)
