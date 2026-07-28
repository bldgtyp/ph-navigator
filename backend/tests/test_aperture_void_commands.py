"""Command-contract regressions for glazed/void aperture elements."""

from __future__ import annotations

from typing import cast

import pytest
from fastapi import HTTPException

from features.project_document.aperture_commands.dispatcher import apply_aperture_command
from features.project_document.aperture_commands.models import (
    AddColumn,
    AddRow,
    ApertureCommand,
    DeleteRow,
    MergeElements,
    PasteAssignment,
    PickFrame,
    PickGlazing,
    SetElementKind,
    SetElementOperation,
    SplitElement,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    ApertureElement,
    ApertureElementFrames,
    ApertureElementKind,
    ApertureOperation,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document

FRAME_ID = "pfrm_void_test"
GLAZING_ID = "pglz_void_test"


class _Catalog:
    def get_default_frame(self) -> FrameRef:
        return FrameRef(name=APERTURE_DEFAULT_FRAME_NAME, width_mm=50.0)

    def get_default_glazing(self) -> GlazingRef:
        return GlazingRef(name=APERTURE_DEFAULT_GLAZING_NAME, u_value_w_m2k=1.0, g_value=0.5)


CATALOG: DefaultsCatalogReader = _Catalog()


def _element(
    element_id: str,
    *,
    row_span: tuple[int, int] = (0, 0),
    column_span: tuple[int, int] = (0, 0),
    kind: ApertureElementKind = "glazed",
    assigned: bool = False,
) -> ApertureElement:
    return ApertureElement.model_validate(
        {
            "id": element_id,
            "name": element_id,
            "kind": kind,
            "row_span": row_span,
            "column_span": column_span,
            "frames": {
                "top": FRAME_ID if assigned else None,
                "right": FRAME_ID if assigned else None,
                "bottom": FRAME_ID if assigned else None,
                "left": FRAME_ID if assigned else None,
            },
            "glazing_id": GLAZING_ID if assigned else None,
            "operation": {"type": "swing", "directions": ["left"]} if assigned else None,
        }
    )


def _aperture(
    elements: list[ApertureElement],
    *,
    row_heights_mm: list[float] | None = None,
    column_widths_mm: list[float] | None = None,
) -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id="apt_void_test",
        name="Void Test",
        row_heights_mm=row_heights_mm or [1000.0],
        column_widths_mm=column_widths_mm or [1000.0],
        elements=elements,
    )


def _body(aperture: ApertureTypeEntry) -> ProjectDocumentV1:
    body = empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))
    tables = body.tables.model_copy(
        update={
            "apertures": [aperture],
            "project_frames": [ProjectFrame(id=FRAME_ID, name="Test Frame")],
            "project_glazings": [ProjectGlazing(id=GLAZING_ID, name="Test Glazing")],
        }
    )
    return ProjectDocumentV1.model_validate(body.model_copy(update={"tables": tables}).model_dump(mode="json"))


def _apply(
    body: ProjectDocumentV1,
    command: ApertureCommand,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_aperture_command(
        body,
        command,
        actor_user_id="user-1",
        catalog=CATALOG,
    )


def _error_code(exc: HTTPException) -> str:
    detail = cast(dict[str, object], exc.detail)
    return cast(str, detail["error_code"])


def test_set_element_kind_void_clears_assignments_and_audits() -> None:
    body = _body(_aperture([_element("aptel_assigned", assigned=True)]))

    updated, audit = _apply(
        body,
        SetElementKind(
            aperture_type_id="apt_void_test",
            element_ids=["aptel_assigned"],
            element_kind="void",
        ),
    )

    element = updated.tables.apertures[0].elements[0]
    assert element.kind == "void"
    assert element.frames == ApertureElementFrames()
    assert element.glazing_id is None
    assert element.operation is None
    assert audit["action_kind"] == "project_version_aperture_element_set_kind"
    payload = cast(dict[str, object], audit["payload"])
    assert payload["changed_element_ids"] == ["aptel_assigned"]
    assert payload["element_kind"] == "void"


def test_set_element_kind_batch_is_atomic_and_idempotent() -> None:
    body = _body(
        _aperture(
            [
                _element("aptel_glazed_a", column_span=(0, 0), assigned=True),
                _element("aptel_glazed_b", column_span=(1, 1), assigned=True),
                _element("aptel_void", column_span=(2, 2), kind="void"),
            ],
            column_widths_mm=[1000.0, 1000.0, 1000.0],
        )
    )

    updated, audit = _apply(
        body,
        SetElementKind(
            aperture_type_id="apt_void_test",
            element_ids=["aptel_glazed_a", "aptel_glazed_b", "aptel_void"],
            element_kind="void",
        ),
    )
    assert {element.kind for element in updated.tables.apertures[0].elements} == {"void"}
    assert all(element.frames == ApertureElementFrames() for element in updated.tables.apertures[0].elements)
    payload = cast(dict[str, object], audit["payload"])
    assert payload["changed_element_ids"] == ["aptel_glazed_a", "aptel_glazed_b"]

    unchanged, no_op_audit = _apply(
        updated,
        SetElementKind(
            aperture_type_id="apt_void_test",
            element_ids=["aptel_glazed_a", "aptel_glazed_b", "aptel_void"],
            element_kind="void",
        ),
    )
    assert unchanged is updated
    assert cast(dict[str, object], no_op_audit["payload"])["changed_element_ids"] == []


def test_set_element_kind_glazed_round_trip_and_unknown_id_is_atomic() -> None:
    body = _body(_aperture([_element("aptel_void", kind="void")]))
    glazed, _ = _apply(
        body,
        SetElementKind(
            aperture_type_id="apt_void_test",
            element_ids=["aptel_void"],
            element_kind="glazed",
        ),
    )
    assert glazed.tables.apertures[0].elements[0].kind == "glazed"

    with pytest.raises(HTTPException) as exc_info:
        _apply(
            glazed,
            SetElementKind(
                aperture_type_id="apt_void_test",
                element_ids=["aptel_void", "aptel_missing"],
                element_kind="void",
            ),
        )
    assert _error_code(exc_info.value) == "aperture_element_not_found"
    assert glazed.tables.apertures[0].elements[0].kind == "glazed"


def test_set_element_kind_unknown_aperture_uses_existing_error() -> None:
    body = _body(_aperture([_element("aptel_glazed")]))
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            SetElementKind(
                aperture_type_id="apt_missing",
                element_ids=["aptel_glazed"],
                element_kind="void",
            ),
        )
    assert _error_code(exc_info.value) == "aperture_type_not_found"


@pytest.mark.parametrize(
    "command",
    [
        SetElementOperation(
            aperture_type_id="apt_void_test",
            element_id="aptel_void",
            operation=ApertureOperation(type="swing", directions=["left"]),
        ),
        PickFrame(
            aperture_type_id="apt_void_test",
            element_id="aptel_void",
            side="top",
            frame=FrameRef(name="Frame"),
        ),
        PickGlazing(
            aperture_type_id="apt_void_test",
            element_id="aptel_void",
            glazing=GlazingRef(name="Glazing"),
        ),
    ],
)
def test_assignment_commands_reject_void_target_without_mutating(command: ApertureCommand) -> None:
    body = _body(_aperture([_element("aptel_void", kind="void")]))
    with pytest.raises(HTTPException) as exc_info:
        _apply(body, command)
    assert _error_code(exc_info.value) == "aperture_element_is_void"
    assert body.tables.apertures[0].elements[0].kind == "void"


@pytest.mark.parametrize(
    ("source_id", "target_id"),
    [("aptel_void", "aptel_glazed"), ("aptel_glazed", "aptel_void")],
)
def test_paste_assignment_rejects_void_source_or_target(source_id: str, target_id: str) -> None:
    body = _body(
        _aperture(
            [
                _element("aptel_glazed", column_span=(0, 0)),
                _element("aptel_void", column_span=(1, 1), kind="void"),
            ],
            column_widths_mm=[1000.0, 1000.0],
        )
    )
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            PasteAssignment(
                aperture_type_id="apt_void_test",
                source_element_id=source_id,
                target_element_ids=[target_id],
            ),
        )
    assert _error_code(exc_info.value) == "aperture_element_is_void"
    assert [element.kind for element in body.tables.apertures[0].elements] == ["glazed", "void"]


def test_merge_and_split_preserve_void_kind_and_mixed_merge_rejects() -> None:
    void_body = _body(
        _aperture(
            [
                _element("aptel_void_a", column_span=(0, 0), kind="void"),
                _element("aptel_void_b", column_span=(1, 1), kind="void"),
            ],
            column_widths_mm=[1000.0, 1000.0],
        )
    )
    merged, _ = _apply(
        void_body,
        MergeElements(
            aperture_type_id="apt_void_test",
            element_ids=["aptel_void_a", "aptel_void_b"],
        ),
    )
    spanning = merged.tables.apertures[0].elements[0]
    assert spanning.kind == "void"
    split, _ = _apply(
        merged,
        SplitElement(aperture_type_id="apt_void_test", element_id=spanning.id),
    )
    assert len(split.tables.apertures[0].elements) == 2
    assert {element.kind for element in split.tables.apertures[0].elements} == {"void"}

    mixed = _body(
        _aperture(
            [
                _element("aptel_glazed", column_span=(0, 0)),
                _element("aptel_void", column_span=(1, 1), kind="void"),
            ],
            column_widths_mm=[1000.0, 1000.0],
        )
    )
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            mixed,
            MergeElements(
                aperture_type_id="apt_void_test",
                element_ids=["aptel_glazed", "aptel_void"],
            ),
        )
    assert _error_code(exc_info.value) == "aperture_merge_mixed_kinds"


@pytest.mark.parametrize(
    ("command", "span_field"),
    [
        (AddRow(aperture_type_id="apt_void_test", at_index=1, height_mm=500.0), "row_span"),
        (AddColumn(aperture_type_id="apt_void_test", at_index=1, width_mm=500.0), "column_span"),
    ],
)
def test_inserting_through_void_extends_its_span(command: ApertureCommand, span_field: str) -> None:
    body = _body(
        _aperture(
            [
                _element(
                    "aptel_void",
                    row_span=(0, 1),
                    column_span=(0, 1),
                    kind="void",
                )
            ],
            row_heights_mm=[1000.0, 1000.0],
            column_widths_mm=[1000.0, 1000.0],
        )
    )
    updated, _ = _apply(body, command)
    element = updated.tables.apertures[0].elements[0]
    assert element.kind == "void"
    assert getattr(element, span_field) == (0, 2)


def test_delete_row_can_leave_valid_all_void_aperture() -> None:
    body = _body(
        _aperture(
            [
                _element("aptel_glazed", row_span=(0, 0), assigned=True),
                _element("aptel_void", row_span=(1, 1), kind="void"),
            ],
            row_heights_mm=[1000.0, 1000.0],
        )
    )
    updated, _ = _apply(body, DeleteRow(aperture_type_id="apt_void_test", index=0))
    remaining = updated.tables.apertures[0].elements
    assert len(remaining) == 1
    assert remaining[0].kind == "void"
    assert remaining[0].row_span == (0, 0)
