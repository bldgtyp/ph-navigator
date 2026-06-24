"""Project aperture glazing/frame entity contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.apertures._ref_helpers import (
    ensure_project_frame,
    ensure_project_glazing,
)
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentTables,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _origin(table: str, record_id: str) -> dict[str, Any]:
    return {
        "catalog_table": table,
        "catalog_record_id": record_id,
        "catalog_schema_version": 1,
        "synced_at": "2026-06-24T21:30:00Z",
        "local_overrides": [],
    }


def _frame_ref(*, record_id: str = "recPHNDefFrame001", name: str = "Default frame") -> dict[str, Any]:
    return {
        "name": name,
        "manufacturer": "Frame Co",
        "brand": None,
        "use": None,
        "operation": None,
        "location": None,
        "mull_type": None,
        "prefix": None,
        "suffix": None,
        "material": "wood",
        "width_mm": 90.0,
        "u_value_w_m2k": 1.1,
        "psi_g_w_mk": 0.04,
        "psi_install_w_mk": 0.02,
        "color": "#aabbcc",
        "source": "catalog",
        "datasheet_url": "https://example.test/frame.pdf",
        "comments": None,
        "catalog_origin": _origin("frame_types", record_id),
    }


def _hand_frame_ref() -> dict[str, Any]:
    frame = _frame_ref(name="Hand frame")
    frame["catalog_origin"] = None
    return frame


def _glazing_ref(*, record_id: str = "recPHNDefGlazng01") -> dict[str, Any]:
    return {
        "name": "Default glazing",
        "manufacturer": "Glass Co",
        "brand": None,
        "suffix": None,
        "u_value_w_m2k": 0.7,
        "g_value": 0.5,
        "color": "#ddeeff",
        "source": "catalog",
        "datasheet_url": "https://example.test/glazing.pdf",
        "comments": None,
        "catalog_origin": _origin("glazing_types", record_id),
    }


def _empty_raw_document() -> dict[str, Any]:
    body = empty_project_document(
        CreateProjectRequest(
            name="West Stockbridge House",
            bt_number="2426",
            cert_programs=["phi"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )
    return body.model_dump(mode="json")


def test_project_glazing_and_frame_models_mirror_material_contract() -> None:
    glazing = ProjectGlazing.model_validate(
        {
            "id": "pglz_test",
            **{key: value for key, value in _glazing_ref().items() if key != "datasheet_url"},
            "specification_status": "missing",
            "datasheet_asset_ids": [],
        }
    )
    frame = ProjectFrame.model_validate(
        {
            "id": "pfrm_test",
            **{key: value for key, value in _frame_ref().items() if key != "datasheet_url"},
            "specification_status": "missing",
            "datasheet_asset_ids": [],
        }
    )

    assert glazing.color == "#ddeeff"
    assert frame.color == "#aabbcc"

    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        ProjectGlazing.model_validate({**glazing.model_dump(mode="json"), "datasheet_url": "legacy"})
    with pytest.raises(ValidationError, match="catalog_table must be 'frame_types'"):
        ProjectFrame.model_validate(
            {
                **frame.model_dump(mode="json"),
                "catalog_origin": _origin("glazing_types", "recPHNDefGlazng01"),
            }
        )


def test_aperture_refs_must_resolve_to_flat_project_entities() -> None:
    raw = _empty_raw_document()
    raw["tables"]["project_glazings"] = [
        {
            "id": "pglz_default",
            **{key: value for key, value in _glazing_ref().items() if key != "datasheet_url"},
            "specification_status": "missing",
            "datasheet_asset_ids": [],
        }
    ]
    raw["tables"]["project_frames"] = [
        {
            "id": "pfrm_default",
            **{key: value for key, value in _frame_ref().items() if key != "datasheet_url"},
            "specification_status": "missing",
            "datasheet_asset_ids": [],
        }
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
                        "top": "pfrm_default",
                        "right": "pfrm_default",
                        "bottom": "pfrm_default",
                        "left": "pfrm_missing",
                    },
                    "glazing_id": "pglz_default",
                    "operation": None,
                }
            ],
        }
    ]

    with pytest.raises(ValidationError, match="Unknown frame_id 'pfrm_missing'"):
        ProjectDocumentV1.model_validate(raw)


def test_ensure_project_entities_dedup_catalog_refs_and_append_hand_entered_refs() -> None:
    tables = ProjectDocumentTables()
    frame_ref = FrameRef.model_validate(_frame_ref())
    glazing_ref = GlazingRef.model_validate(_glazing_ref())

    assert ensure_project_frame(tables, frame_ref) == ensure_project_frame(tables, frame_ref)
    assert ensure_project_glazing(tables, glazing_ref) == ensure_project_glazing(tables, glazing_ref)
    assert len(tables.project_frames) == 1
    assert len(tables.project_glazings) == 1

    hand_ref = FrameRef.model_validate(_hand_frame_ref())
    first = ensure_project_frame(tables, hand_ref)
    second = ensure_project_frame(tables, hand_ref)

    assert first != second
    assert len(tables.project_frames) == 3


def test_v11_inline_refs_migrate_to_flat_tables_and_fk_slots() -> None:
    raw = _empty_raw_document()
    raw["schema_version"] = 11
    default_frame = _frame_ref()
    hand_frame = _hand_frame_ref()
    raw["tables"]["apertures"] = [
        {
            "id": "apt_window_a",
            "name": "Window A",
            "row_heights_mm": [1000.0],
            "column_widths_mm": [1000.0],
            "elements": [
                {
                    "id": "aptel_a",
                    "name": "Sash A",
                    "row_span": [0, 0],
                    "column_span": [0, 0],
                    "frames": {
                        "top": default_frame,
                        "right": default_frame,
                        "bottom": default_frame,
                        "left": hand_frame,
                    },
                    "glazing": _glazing_ref(),
                    "operation": None,
                }
            ],
        },
        {
            "id": "apt_window_b",
            "name": "Window B",
            "row_heights_mm": [1000.0],
            "column_widths_mm": [1000.0],
            "elements": [
                {
                    "id": "aptel_b",
                    "name": "Sash B",
                    "row_span": [0, 0],
                    "column_span": [0, 0],
                    "frames": {
                        "top": default_frame,
                        "right": default_frame,
                        "bottom": default_frame,
                        "left": default_frame,
                    },
                    "glazing": _glazing_ref(),
                    "operation": None,
                }
            ],
        },
    ]

    migrated = ProjectDocumentV1.model_validate(raw)

    assert migrated.schema_version == 12
    assert len(migrated.tables.project_frames) == 2
    assert len(migrated.tables.project_glazings) == 1
    default_frame_id = next(frame.id for frame in migrated.tables.project_frames if frame.catalog_origin is not None)
    hand_frame_id = next(frame.id for frame in migrated.tables.project_frames if frame.catalog_origin is None)
    assert migrated.tables.apertures[0].elements[0].frames.top == default_frame_id
    assert migrated.tables.apertures[0].elements[0].frames.left == hand_frame_id
    assert migrated.tables.apertures[1].elements[0].frames.left == default_frame_id
    assert migrated.tables.apertures[0].elements[0].glazing_id == migrated.tables.project_glazings[0].id

    assert ProjectDocumentV1.model_validate(migrated.model_dump(mode="json")) == migrated


def test_v12_aperture_models_accept_fk_fields_directly() -> None:
    element = ApertureElement(
        id="aptel_direct",
        name="Direct",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top="pfrm_one", right="pfrm_one", bottom="pfrm_one", left="pfrm_one"),
        glazing_id="pglz_one",
    )
    aperture = ApertureTypeEntry(
        id="apt_direct",
        name="Direct",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[element],
    )

    assert aperture.elements[0].glazing_id == "pglz_one"
