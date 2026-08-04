"""Effective Ψ-install resolution, install commands, hygiene, and emission.

Phase 02 of aperture-psi-install: the resolver precedence (mull → assigned
→ default), the three install commands, grid-mutation slot hygiene, the
route-3 `installs` block + uniform `frame_type` default (D-5), the U-value
report edge values, and the apertures slice summary payload.
"""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException

from features.aperture_u_value.cache import content_hash_for_aperture
from features.aperture_u_value.service import calculate_aperture_u_value_terms
from features.gh_api.aperture_types_export import export_aperture_types
from features.project_document.aperture_commands.dispatcher import apply_aperture_command
from features.project_document.aperture_commands.models import (
    ApertureCommand,
    ApplyInstallToApertures,
    CopyElementInstalls,
    FlipLeftRight,
    PasteAssignment,
    SetElementInstall,
    SetElementKind,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.apertures.install_psi import (
    default_install_psi_w_mk,
    resolve_install_psi_for_aperture,
)
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    ApertureElement,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.project_document.tables.aperture_install_types import APERTURE_INSTALL_DEFAULT_TYPE_ID
from features.project_document.tables.apertures import apertures_response
from features.projects.models import CertificationProgram, CreateProjectRequest
from features.projects.service import empty_project_document
from tests.test_project_document_aperture_install_types import _install_type

FRAME_ID = "pfrm_install_test"
GLAZING_ID = "pglz_install_test"
FLIXO_TYPE_ID = "apit_flixo_sill"


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
    kind: str = "glazed",
    installs: dict[str, str | None] | None = None,
) -> ApertureElement:
    glazed = kind == "glazed"
    return ApertureElement.model_validate(
        {
            "id": element_id,
            "name": element_id,
            "kind": kind,
            "row_span": row_span,
            "column_span": column_span,
            "frames": {side: FRAME_ID if glazed else None for side in ("top", "right", "bottom", "left")},
            "installs": installs or {},
            "glazing_id": GLAZING_ID if glazed else None,
        }
    )


def _aperture(
    elements: list[ApertureElement],
    *,
    aperture_id: str = "apt_install_test",
    name: str = "Install Test",
    row_heights_mm: list[float] | None = None,
    column_widths_mm: list[float] | None = None,
) -> ApertureTypeEntry:
    return ApertureTypeEntry(
        id=aperture_id,
        name=name,
        row_heights_mm=row_heights_mm or [1000.0],
        column_widths_mm=column_widths_mm or [1000.0],
        elements=elements,
    )


def _body(*apertures: ApertureTypeEntry, cert_programs: list[CertificationProgram] | None = None) -> ProjectDocumentV1:
    body = empty_project_document(
        CreateProjectRequest(
            name="Installs",
            bt_number="BT-1",
            cert_programs=cert_programs if cert_programs is not None else ["phius"],
        )
    )
    body.tables.aperture_install_types.rows.append(_install_type(FLIXO_TYPE_ID, "Flixo Sill", 0.021))
    tables = body.tables.model_copy(
        update={
            "apertures": list(apertures),
            "project_frames": [
                ProjectFrame(id=FRAME_ID, name="Test Frame", width_mm=80.0, u_value_w_m2k=1.0, psi_g_w_mk=0.04)
            ],
            "project_glazings": [ProjectGlazing(id=GLAZING_ID, name="Test Glazing", u_value_w_m2k=0.8, g_value=0.5)],
        }
    )
    return ProjectDocumentV1.model_validate(body.model_copy(update={"tables": tables}).model_dump(mode="json"))


def _error_code(exc: HTTPException) -> str:
    detail = cast(dict[str, Any], exc.detail)
    return str(detail["error_code"])


def _apply(body: ProjectDocumentV1, command: ApertureCommand) -> ProjectDocumentV1:
    next_body, _audit = apply_aperture_command(body, command, actor_user_id="user-1", catalog=CATALOG)
    return next_body


def _mull_pair() -> ApertureTypeEntry:
    return _aperture(
        [
            _element("aptel_left", column_span=(0, 0), installs={"top": FLIXO_TYPE_ID}),
            _element("aptel_right", column_span=(1, 1)),
        ],
        column_widths_mm=[800.0, 800.0],
    )


# --- resolver ----------------------------------------------------------------


def test_resolver_precedence_mull_assigned_default() -> None:
    body = _body(_mull_pair())
    resolution = resolve_install_psi_for_aperture(body.tables.apertures[0], body.tables)

    assigned = resolution.values[("aptel_left", "top")]
    assert (assigned.source, assigned.psi_w_mk, assigned.install_type_id) == ("assigned", 0.021, FLIXO_TYPE_ID)
    assert assigned.install_type_name == "Flixo Sill"

    mull = resolution.values[("aptel_left", "right")]
    assert (mull.source, mull.psi_w_mk, mull.install_type_id) == ("mull", 0.0, None)

    inherited = resolution.values[("aptel_left", "bottom")]
    assert (inherited.source, inherited.psi_w_mk) == ("default", 0.052)
    assert inherited.install_type_id == APERTURE_INSTALL_DEFAULT_TYPE_ID
    assert resolution.warnings == []


def test_resolver_ignores_stale_interior_assignment() -> None:
    aperture = _aperture(
        [
            _element("aptel_left", column_span=(0, 0), installs={"right": FLIXO_TYPE_ID}),
            _element("aptel_right", column_span=(1, 1)),
        ],
        column_widths_mm=[800.0, 800.0],
    )
    body = _body(aperture)
    resolution = resolve_install_psi_for_aperture(body.tables.apertures[0], body.tables)
    stale = resolution.values[("aptel_left", "right")]
    assert (stale.source, stale.psi_w_mk) == ("mull", 0.0)


def test_resolver_missing_ref_falls_back_to_default_with_warning() -> None:
    body = _body(_aperture([_element("aptel_a")]))
    raw = body.model_dump(mode="json")
    raw["tables"]["apertures"][0]["elements"][0]["installs"]["top"] = "apit_ghost"
    # Bypass reference validation on purpose: build tables straight from the
    # raw dict the way a stale external write would look.
    from features.project_document.document import ProjectDocumentTables

    tables = ProjectDocumentTables.model_validate(raw["tables"])
    resolution = resolve_install_psi_for_aperture(tables.apertures[0], tables)
    fallback = resolution.values[("aptel_a", "top")]
    assert (fallback.source, fallback.psi_w_mk) == ("default", 0.052)
    assert [w.kind for w in resolution.warnings] == ["missing_install_type_ref"]


def test_resolver_psi_unset_resolves_zero_with_warning() -> None:
    body = _body(_aperture([_element("aptel_a", installs={"top": FLIXO_TYPE_ID})]))
    del body.tables.aperture_install_types.rows[-1].custom_values["psi_w_mk"]
    resolution = resolve_install_psi_for_aperture(body.tables.apertures[0], body.tables)
    unset = resolution.values[("aptel_a", "top")]
    assert (unset.source, unset.psi_w_mk) == ("assigned", 0.0)
    assert [w.kind for w in resolution.warnings] == ["install_type_psi_unset"]


@pytest.mark.parametrize(("cert_programs", "expected"), [(["phius"], 0.052), (["phi"], 0.04)])
def test_default_install_psi_is_program_aware(cert_programs: list[CertificationProgram], expected: float) -> None:
    body = _body(_aperture([_element("aptel_a")]), cert_programs=cert_programs)
    assert default_install_psi_w_mk(body.tables) == expected
    resolution = resolve_install_psi_for_aperture(body.tables.apertures[0], body.tables)
    assert resolution.values[("aptel_a", "top")].psi_w_mk == expected


# --- commands ----------------------------------------------------------------


def test_set_element_install_assigns_and_clears() -> None:
    body = _body(_aperture([_element("aptel_a")]))
    assigned = _apply(
        body,
        SetElementInstall(
            aperture_type_id="apt_install_test",
            element_id="aptel_a",
            side="top",
            install_type_id=FLIXO_TYPE_ID,
        ),
    )
    assert assigned.tables.apertures[0].elements[0].installs.top == FLIXO_TYPE_ID
    cleared = _apply(
        assigned,
        SetElementInstall(aperture_type_id="apt_install_test", element_id="aptel_a", side="top", install_type_id=None),
    )
    assert cleared.tables.apertures[0].elements[0].installs.top is None


def test_set_element_install_rejects_interior_side() -> None:
    body = _body(_mull_pair())
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            SetElementInstall(
                aperture_type_id="apt_install_test",
                element_id="aptel_left",
                side="right",
                install_type_id=FLIXO_TYPE_ID,
            ),
        )
    assert exc_info.value.status_code == 422
    assert _error_code(exc_info.value) == "aperture_install_side_is_interior"


def test_set_element_install_rejects_void_element_and_unknown_type() -> None:
    body = _body(
        _aperture(
            [_element("aptel_a", column_span=(0, 0)), _element("aptel_void", column_span=(1, 1), kind="void")],
            column_widths_mm=[800.0, 800.0],
        )
    )
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            SetElementInstall(
                aperture_type_id="apt_install_test",
                element_id="aptel_void",
                side="top",
                install_type_id=FLIXO_TYPE_ID,
            ),
        )
    assert _error_code(exc_info.value) == "aperture_element_is_void"
    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            SetElementInstall(
                aperture_type_id="apt_install_test",
                element_id="aptel_a",
                side="top",
                install_type_id="apit_ghost",
            ),
        )
    assert exc_info.value.status_code == 404
    assert _error_code(exc_info.value) == "aperture_install_type_not_found"


def test_apply_install_to_apertures_sets_only_perimeter_edges() -> None:
    other = _aperture([_element("aptel_other")], aperture_id="apt_other", name="Other")
    body = _body(_mull_pair(), other)
    bulk = _apply(
        body,
        ApplyInstallToApertures(aperture_ids=["apt_install_test", "apt_other"], install_type_id=FLIXO_TYPE_ID),
    )
    left, right = bulk.tables.apertures[0].elements
    assert left.installs.model_dump(mode="python") == {
        "top": FLIXO_TYPE_ID,
        "right": None,  # interior mull edge stays unassigned
        "bottom": FLIXO_TYPE_ID,
        "left": FLIXO_TYPE_ID,
    }
    assert right.installs.left is None
    assert bulk.tables.apertures[1].elements[0].installs.model_dump(mode="python") == {
        side: FLIXO_TYPE_ID for side in ("top", "right", "bottom", "left")
    }


def test_copy_element_installs_requires_identical_grid() -> None:
    source = _mull_pair()
    twin = _aperture(
        [_element("aptel_t_left", column_span=(0, 0)), _element("aptel_t_right", column_span=(1, 1))],
        aperture_id="apt_twin",
        name="Twin",
        column_widths_mm=[900.0, 900.0],  # same signature: mm dims may differ
    )
    odd = _aperture([_element("aptel_odd")], aperture_id="apt_odd", name="Odd")
    body = _body(source, twin, odd)

    copied = _apply(
        body,
        CopyElementInstalls(source_aperture_id="apt_install_test", target_aperture_ids=["apt_twin"]),
    )
    twin_left = next(el for el in copied.tables.apertures[1].elements if el.column_span == (0, 0))
    assert twin_left.installs.top == FLIXO_TYPE_ID

    with pytest.raises(HTTPException) as exc_info:
        _apply(
            body,
            CopyElementInstalls(source_aperture_id="apt_install_test", target_aperture_ids=["apt_odd"]),
        )
    assert exc_info.value.status_code == 422
    assert _error_code(exc_info.value) == "aperture_installs_copy_grid_mismatch"


# --- grid-mutation hygiene ---------------------------------------------------


def test_flip_left_right_swaps_install_slots() -> None:
    body = _body(
        _aperture(
            [_element("aptel_a", installs={"left": FLIXO_TYPE_ID, "top": FLIXO_TYPE_ID})],
        )
    )
    flipped = _apply(body, FlipLeftRight(aperture_type_id="apt_install_test"))
    installs = flipped.tables.apertures[0].elements[0].installs
    assert installs.right == FLIXO_TYPE_ID
    assert installs.left is None
    assert installs.top == FLIXO_TYPE_ID


def test_paste_assignment_copies_install_slots() -> None:
    body = _body(
        _aperture(
            [
                _element("aptel_src", column_span=(0, 0), installs={"top": FLIXO_TYPE_ID}),
                _element("aptel_dst", column_span=(1, 1)),
            ],
            column_widths_mm=[800.0, 800.0],
        )
    )
    pasted = _apply(
        body,
        PasteAssignment(
            aperture_type_id="apt_install_test",
            source_element_id="aptel_src",
            target_element_ids=["aptel_dst"],
        ),
    )
    target = next(el for el in pasted.tables.apertures[0].elements if el.id == "aptel_dst")
    assert target.installs.top == FLIXO_TYPE_ID


def test_set_element_kind_void_clears_install_slots() -> None:
    body = _body(
        _aperture(
            [
                _element("aptel_a", column_span=(0, 0), installs={"top": FLIXO_TYPE_ID}),
                _element("aptel_b", column_span=(1, 1)),
            ],
            column_widths_mm=[800.0, 800.0],
        )
    )
    voided = _apply(
        body,
        SetElementKind(aperture_type_id="apt_install_test", element_ids=["aptel_a"], element_kind="void"),
    )
    voided_element = next(el for el in voided.tables.apertures[0].elements if el.id == "aptel_a")
    assert voided_element.kind == "void"
    assert voided_element.installs.model_dump(mode="python") == {
        "top": None,
        "right": None,
        "bottom": None,
        "left": None,
    }


# --- route 3 -----------------------------------------------------------------


def test_export_emits_effective_installs_and_uniform_frame_default() -> None:
    body = _body(_mull_pair())
    payload = export_aperture_types(body)["Install Test"]
    left = next(el for el in payload["elements"] if el["name"] == "aptel_left")
    assert left["installs"]["top"] == {
        "install_type_id": FLIXO_TYPE_ID,
        "name": "Flixo Sill",
        "psi_install_w_mk": 0.021,
        "source": "assigned",
    }
    assert left["installs"]["right"] == {
        "install_type_id": None,
        "name": None,
        "psi_install_w_mk": 0.0,
        "source": "mull",
    }
    assert left["installs"]["bottom"]["source"] == "default"
    assert left["installs"]["bottom"]["psi_install_w_mk"] == 0.052

    # frame_type carries the uniform program Default on every block (D-5),
    # regardless of per-edge assignments.
    for element in payload["elements"]:
        for side in ("top", "right", "bottom", "left"):
            frame_block = element["frames"][side]
            assert frame_block is not None
            assert frame_block["frame_type"]["psi_install_w_mk"] == 0.052


# --- U-value report + slice payload -----------------------------------------


def test_u_value_edges_carry_resolved_psi_install() -> None:
    body = _body(_mull_pair())
    entry = body.tables.apertures[0]
    calc = calculate_aperture_u_value_terms(entry, body.tables)
    left = next(detail for detail in calc.elements if detail.element_id == "aptel_left")
    by_side = {edge.side: edge for edge in left.edges}
    assert by_side["top"].psi_install_w_mk == 0.021
    assert by_side["right"].psi_install_w_mk == 0.0  # mull edge
    assert by_side["bottom"].psi_install_w_mk == 0.052  # inherited default


def test_content_hash_changes_when_install_assignment_changes() -> None:
    body = _body(_mull_pair())
    entry = body.tables.apertures[0]
    before = content_hash_for_aperture(entry, body.tables)
    reassigned = _apply(
        body,
        SetElementInstall(
            aperture_type_id="apt_install_test", element_id="aptel_left", side="top", install_type_id=None
        ),
    )
    after = content_hash_for_aperture(reassigned.tables.apertures[0], reassigned.tables)
    assert before != after


def test_apertures_slice_includes_install_type_summaries() -> None:
    from uuid import uuid4

    body = _body(_mull_pair())
    response = apertures_response(uuid4(), uuid4(), "draft", "etag-v", None, body)
    summaries = {summary.id: summary for summary in response.aperture_install_types}
    assert summaries[APERTURE_INSTALL_DEFAULT_TYPE_ID].psi_w_mk == 0.052
    flixo = summaries[FLIXO_TYPE_ID]
    assert (flixo.name, flixo.psi_w_mk, flixo.has_pdf) == ("Flixo Sill", 0.021, False)
    assert flixo.source == "opt_apit_src_calculated"
