"""Shared public-safe aperture layouts for Empty-panel regressions."""

from __future__ import annotations

from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest

FRAME_ID = "pfrm_void_fixture"
MULLION_FRAME_ID = "pfrm_void_mullion"
GLAZING_ID = "pglz_void_fixture"


def aperture_void_document() -> ProjectDocumentV1:
    body = empty_project_document(CreateProjectRequest(name="Void fixture", bt_number="VOID"))
    body.tables.project_frames = [
        ProjectFrame(
            id=FRAME_ID,
            name="Jamb frame",
            width_mm=80.0,
            u_value_w_m2k=1.0,
            psi_g_w_mk=0.04,
        ),
        ProjectFrame(
            id=MULLION_FRAME_ID,
            name="Mullion frame",
            mull_type="OP-to-FX",
            width_mm=80.0,
            u_value_w_m2k=1.0,
            psi_g_w_mk=0.04,
        ),
    ]
    body.tables.project_glazings = [
        ProjectGlazing(
            id=GLAZING_ID,
            name="Triple glazing",
            u_value_w_m2k=0.8,
            g_value=0.5,
        )
    ]
    return body


def glazed_element(
    element_id: str,
    *,
    row_span: tuple[int, int],
    column_span: tuple[int, int],
    frame_id: str = FRAME_ID,
) -> ApertureElement:
    return ApertureElement(
        id=element_id,
        name=element_id,
        row_span=row_span,
        column_span=column_span,
        frames=ApertureElementFrames(
            top=frame_id,
            right=frame_id,
            bottom=frame_id,
            left=frame_id,
        ),
        glazing_id=GLAZING_ID,
    )


def void_element(
    element_id: str,
    *,
    row_span: tuple[int, int],
    column_span: tuple[int, int],
) -> ApertureElement:
    return ApertureElement(
        id=element_id,
        name=element_id,
        kind="void",
        row_span=row_span,
        column_span=column_span,
    )


def s15_aperture() -> ApertureTypeEntry:
    """Four-by-four layout with full-height doors and two sill-line voids."""
    return ApertureTypeEntry(
        id="apt_S15",
        name="S15",
        row_heights_mm=[500.0, 500.0, 500.0, 500.0],
        column_widths_mm=[500.0, 900.0, 900.0, 500.0],
        elements=[
            glazed_element("aptel_left_sidelite", row_span=(0, 2), column_span=(0, 0)),
            void_element("aptel_left_empty", row_span=(3, 3), column_span=(0, 0)),
            glazed_element("aptel_left_door", row_span=(0, 3), column_span=(1, 1)),
            glazed_element("aptel_right_door", row_span=(0, 3), column_span=(2, 2)),
            glazed_element("aptel_right_sidelite", row_span=(0, 2), column_span=(3, 3)),
            void_element("aptel_right_empty", row_span=(3, 3), column_span=(3, 3)),
        ],
    )


def fully_void_column_aperture() -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id="apt_void_column",
        name="Void column",
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[800.0, 400.0, 800.0],
        elements=[
            glazed_element("aptel_left", row_span=(0, 1), column_span=(0, 0)),
            void_element("aptel_middle_empty", row_span=(0, 1), column_span=(1, 1)),
            glazed_element("aptel_right", row_span=(0, 1), column_span=(2, 2)),
        ],
    )
