"""Aperture model, factory, and command-dispatcher unit tests (Phase 01)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest
from pydantic import ValidationError

from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    CreateApertureType,
    DeleteApertureType,
    DuplicateApertureType,
    RenameApertureType,
    SetElementName,
    SetElementOperation,
)
from features.project_document.apertures.coverage import (
    CoverageError,
    check_aperture_coverage,
)
from features.project_document.apertures.factories import (
    DefaultsCatalogReader,
    build_default_aperture_type,
)
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    ApertureElement,
    ApertureElementFrames,
    ApertureOperation,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document

# -------------------------- Test stubs / fixtures ----------------------------


class _StubCatalog:
    def __init__(self, *, frame: FrameRef | None, glazing: GlazingRef | None) -> None:
        self._frame = frame
        self._glazing = glazing

    def get_default_frame(self) -> FrameRef | None:
        return self._frame

    def get_default_glazing(self) -> GlazingRef | None:
        return self._glazing


def _seeded_catalog() -> DefaultsCatalogReader:
    frame_origin = CatalogOrigin(
        catalog_table="frame_types",
        catalog_record_id="rec0000000000DEFL",
        synced_at=datetime(2026, 6, 5, tzinfo=UTC),
    )
    glazing_origin = CatalogOrigin(
        catalog_table="glazing_types",
        catalog_record_id="rec0000000000DEFG",
        synced_at=datetime(2026, 6, 5, tzinfo=UTC),
    )
    frame = FrameRef(
        name=APERTURE_DEFAULT_FRAME_NAME,
        width_mm=50.0,
        u_value_w_m2k=1.5,
        psi_g_w_mk=0.04,
        color="#888888",
        catalog_origin=frame_origin,
    )
    glazing = GlazingRef(
        name=APERTURE_DEFAULT_GLAZING_NAME,
        u_value_w_m2k=1.0,
        g_value=0.5,
        color="#a8c8ff",
        catalog_origin=glazing_origin,
    )
    return _StubCatalog(frame=frame, glazing=glazing)


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))


def _element(
    *,
    id: str = "aptel_A1",
    name: str = "Unnamed",
    row_span: tuple[int, int] = (0, 0),
    column_span: tuple[int, int] = (0, 0),
    operation: ApertureOperation | None = None,
) -> ApertureElement:
    return ApertureElement(
        id=id,
        name=name,
        row_span=row_span,
        column_span=column_span,
        frames=ApertureElementFrames(),
        glazing=None,
        operation=operation,
    )


def _aperture(
    *,
    id: str = "apt_A",
    name: str = "Type A",
    row_heights_mm: list[float] | None = None,
    column_widths_mm: list[float] | None = None,
    elements: list[ApertureElement] | None = None,
) -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id=id,
        name=name,
        row_heights_mm=row_heights_mm or [1000.0],
        column_widths_mm=column_widths_mm or [1000.0],
        elements=elements or [_element()],
    )


# ------------------------ Coverage / validation ------------------------------


def test_aperture_type_1x1_single_element_validates() -> None:
    entry = _aperture()
    check_aperture_coverage(entry)


def test_aperture_type_2x2_four_elements_validates() -> None:
    entry = _aperture(
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[1000.0, 1000.0],
        elements=[
            _element(id="aptel_TL", row_span=(0, 0), column_span=(0, 0)),
            _element(id="aptel_TR", row_span=(0, 0), column_span=(1, 1)),
            _element(id="aptel_BL", row_span=(1, 1), column_span=(0, 0)),
            _element(id="aptel_BR", row_span=(1, 1), column_span=(1, 1)),
        ],
    )
    check_aperture_coverage(entry)


def test_aperture_type_2x2_single_spanning_element_validates() -> None:
    entry = _aperture(
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[1000.0, 1000.0],
        elements=[_element(id="aptel_S", row_span=(0, 1), column_span=(0, 1))],
    )
    check_aperture_coverage(entry)


def test_aperture_type_rejects_hole() -> None:
    raw = {
        "id": "apt_H",
        "name": "Holed",
        "row_heights_mm": [1000.0, 1000.0],
        "column_widths_mm": [1000.0, 1000.0],
        "elements": [
            {
                "id": "aptel_one",
                "row_span": [0, 0],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        ],
    }
    with pytest.raises(ValidationError) as exc:
        ApertureTypeEntry.model_validate(raw)
    assert "aperture_coverage_hole" in str(exc.value) or "not covered" in str(exc.value)


def test_aperture_type_rejects_overlap() -> None:
    raw = {
        "id": "apt_O",
        "name": "Overlap",
        "row_heights_mm": [1000.0],
        "column_widths_mm": [1000.0, 1000.0],
        "elements": [
            {
                "id": "aptel_a",
                "row_span": [0, 0],
                "column_span": [0, 1],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            },
            {
                "id": "aptel_b",
                "row_span": [0, 0],
                "column_span": [1, 1],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            },
        ],
    }
    with pytest.raises(ValidationError) as exc:
        ApertureTypeEntry.model_validate(raw)
    assert "covered by both" in str(exc.value)


def test_aperture_type_rejects_span_out_of_bounds() -> None:
    raw = {
        "id": "apt_OOB",
        "name": "OOB",
        "row_heights_mm": [1000.0],
        "column_widths_mm": [1000.0],
        "elements": [
            {
                "id": "aptel_oob",
                "row_span": [0, 1],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        ],
    }
    with pytest.raises(ValidationError):
        ApertureTypeEntry.model_validate(raw)


def test_aperture_element_rejects_empty_name() -> None:
    with pytest.raises(ValidationError):
        ApertureElement.model_validate(
            {
                "id": "aptel_X",
                "name": "   ",
                "row_span": [0, 0],
                "column_span": [0, 0],
                "frames": {"top": None, "right": None, "bottom": None, "left": None},
                "glazing": None,
            }
        )


def test_aperture_operation_rejects_duplicate_directions() -> None:
    with pytest.raises(ValidationError):
        ApertureOperation.model_validate({"type": "swing", "directions": ["left", "left"]})


def test_aperture_operation_accepts_none_and_multi_direction() -> None:
    op = ApertureOperation.model_validate({"type": "swing", "directions": ["left", "up"]})
    assert op.type == "swing"
    assert op.directions == ["left", "up"]


def test_coverage_error_carries_structured_detail() -> None:
    entry = ApertureTypeEntry.model_construct(
        id="apt_S",
        name="S",
        row_heights_mm=[1000.0, 1000.0],
        column_widths_mm=[1000.0],
        elements=[_element(id="aptel_top", row_span=(0, 0), column_span=(0, 0))],
    )
    with pytest.raises(CoverageError) as exc:
        check_aperture_coverage(entry)
    assert exc.value.code == "aperture_coverage_hole"
    assert exc.value.detail["cell"] == [1, 0]


# ------------------------ Document-level uniqueness --------------------------


def test_document_rejects_duplicate_aperture_names_trim_case_insensitive() -> None:
    raw_aperture_a: dict[str, Any] = _aperture(id="apt_A", name="Type A").model_dump(mode="json")
    raw_aperture_b = _aperture(id="apt_B", name="  type a  ").model_dump(mode="json")
    body = _empty_body().model_dump(mode="json")
    body["tables"]["apertures"] = [raw_aperture_a, raw_aperture_b]
    with pytest.raises(ValidationError, match="Duplicate aperture name"):
        ProjectDocumentV1.model_validate(body)


# -------------------------- Factory ------------------------------------------


def test_build_default_aperture_type_happy_path() -> None:
    entry = build_default_aperture_type(_seeded_catalog(), name="Type A")
    assert entry.name == "Type A"
    assert entry.row_heights_mm == [1000.0]
    assert entry.column_widths_mm == [1000.0]
    assert len(entry.elements) == 1
    element = entry.elements[0]
    assert element.frames.top is not None
    assert element.frames.right is not None
    assert element.frames.bottom is not None
    assert element.frames.left is not None
    assert element.glazing is not None
    assert element.frames.top.catalog_origin is not None
    assert element.frames.top.catalog_origin.catalog_schema_version == 1
    assert element.glazing.catalog_origin is not None
    assert element.glazing.catalog_origin.catalog_schema_version == 1


def test_build_default_aperture_type_raises_when_frame_seed_missing() -> None:
    catalog = _StubCatalog(frame=None, glazing=GlazingRef(name=APERTURE_DEFAULT_GLAZING_NAME))
    with pytest.raises(Exception) as exc:
        build_default_aperture_type(catalog, name="X")
    assert "aperture_default_refs_missing" in str(exc.value) or "frame" in str(exc.value).lower()


def test_build_default_aperture_type_raises_when_glazing_seed_missing() -> None:
    catalog = _StubCatalog(frame=FrameRef(name=APERTURE_DEFAULT_FRAME_NAME), glazing=None)
    with pytest.raises(Exception) as exc:
        build_default_aperture_type(catalog, name="X")
    assert "aperture_default_refs_missing" in str(exc.value) or "glazing" in str(exc.value).lower()


# -------------------------- Dispatcher ---------------------------------------


def _apply(body: ProjectDocumentV1, command: object) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_aperture_command(body, cast(Any, command), actor_user_id="user-1", catalog=_seeded_catalog())


def test_create_aperture_type_uses_default_autoname_then_suffixes() -> None:
    body = _empty_body()
    body, audit_1 = _apply(body, CreateApertureType())
    assert body.tables.apertures[0].name == "Unnamed Aperture Type"
    assert audit_1["action_kind"] == AUDIT_KIND_BY_APERTURE_COMMAND["createApertureType"]
    body, _ = _apply(body, CreateApertureType())
    assert body.tables.apertures[1].name == "Unnamed Aperture Type (2)"
    body, _ = _apply(body, CreateApertureType(proposed_name="Type B"))
    assert body.tables.apertures[2].name == "Type B"


def test_create_aperture_type_with_colliding_proposed_name_suffixes() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    body, _ = _apply(body, CreateApertureType(proposed_name="  type a  "))
    assert body.tables.apertures[1].name == "Type A (2)"


def test_rename_aperture_type_rejects_collision_case_insensitive() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    body, _ = _apply(body, CreateApertureType(proposed_name="Type B"))
    target_id = body.tables.apertures[1].id
    with pytest.raises(Exception) as exc:
        _apply(body, RenameApertureType(aperture_type_id=target_id, new_name=" TYPE a "))
    assert "aperture_name_collision" in str(exc.value)


def test_rename_aperture_type_persists_trimmed_name() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    aperture_id = body.tables.apertures[0].id
    body, audit = _apply(body, RenameApertureType(aperture_type_id=aperture_id, new_name="  Type X  "))
    assert body.tables.apertures[0].name == "Type X"
    payload = cast(dict[str, object], audit["payload"])
    assert payload["new_name"] == "Type X"


def test_duplicate_aperture_type_mints_fresh_ids() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    source = body.tables.apertures[0]
    body, _ = _apply(body, DuplicateApertureType(aperture_type_id=source.id))
    duplicate = body.tables.apertures[1]
    assert duplicate.id != source.id
    assert duplicate.id.startswith("apt_")
    source_element_ids = {e.id for e in source.elements}
    duplicate_element_ids = {e.id for e in duplicate.elements}
    assert source_element_ids.isdisjoint(duplicate_element_ids)
    assert duplicate.name == "Type A (copy)"


def test_delete_aperture_type_removes_entry() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    body, _ = _apply(body, CreateApertureType(proposed_name="Type B"))
    target_id = body.tables.apertures[0].id
    body, _ = _apply(body, DeleteApertureType(aperture_type_id=target_id))
    assert [a.name for a in body.tables.apertures] == ["Type B"]


def test_set_element_name_persists_trim_and_rejects_empty() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    aperture = body.tables.apertures[0]
    element_id = aperture.elements[0].id
    body, _ = _apply(
        body,
        SetElementName(aperture_type_id=aperture.id, element_id=element_id, new_name="  Living  "),
    )
    assert body.tables.apertures[0].elements[0].name == "Living"
    with pytest.raises(Exception) as exc:
        _apply(body, SetElementName(aperture_type_id=aperture.id, element_id=element_id, new_name="   "))
    assert "aperture_element_name_empty" in str(exc.value) or "must not be empty" in str(exc.value)


def test_set_element_operation_accepts_none_and_swing() -> None:
    body = _empty_body()
    body, _ = _apply(body, CreateApertureType(proposed_name="Type A"))
    aperture = body.tables.apertures[0]
    element_id = aperture.elements[0].id
    body, _ = _apply(
        body,
        SetElementOperation(
            aperture_type_id=aperture.id,
            element_id=element_id,
            operation=ApertureOperation(type="swing", directions=["left", "up"]),
        ),
    )
    op = body.tables.apertures[0].elements[0].operation
    assert op is not None
    assert op.type == "swing"
    assert op.directions == ["left", "up"]
    body, _ = _apply(
        body,
        SetElementOperation(aperture_type_id=aperture.id, element_id=element_id, operation=None),
    )
    assert body.tables.apertures[0].elements[0].operation is None


def test_unknown_command_kind_raises_422() -> None:
    body = _empty_body()

    class _Bogus:
        kind = "totallyBogus"

    with pytest.raises(Exception) as exc:
        apply_aperture_command(body, cast(Any, _Bogus()), actor_user_id="u", catalog=_seeded_catalog())
    assert "aperture_command_unsupported_kind" in str(exc.value)


def test_stub_command_kind_raises_not_implemented() -> None:
    body = _empty_body()

    class _Stub:
        kind = "pickFrame"

    with pytest.raises(Exception) as exc:
        apply_aperture_command(body, cast(Any, _Stub()), actor_user_id="u", catalog=_seeded_catalog())
    assert "aperture_command_not_implemented" in str(exc.value)
