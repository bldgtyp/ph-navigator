"""Tests for ``refreshRefFromCatalog`` (Phase 12 commit 2)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import HTTPException

from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import RefreshRefFromCatalog
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


class _Catalog:
    def get_default_frame(self) -> FrameRef | None:
        return None

    def get_default_glazing(self) -> GlazingRef | None:
        return None


def _catalog() -> DefaultsCatalogReader:
    return _Catalog()


def _origin(local_overrides: list[str] | None = None) -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table="frame_types",
        catalog_record_id="rec000000000FRAME",
        synced_at=datetime(2024, 1, 1, tzinfo=UTC),
        local_overrides=local_overrides or [],
    )


def _frame(u: float = 1.0, local_overrides: list[str] | None = None) -> FrameRef:
    return FrameRef(
        name="F",
        manufacturer="ABC",
        operation="Fixed",
        location="head",
        width_mm=80.0,
        u_value_w_m2k=u,
        psi_g_w_mk=0.04,
        catalog_origin=_origin(local_overrides=local_overrides),
    )


def _body_with_frame(frame: FrameRef) -> ProjectDocumentV1:
    body = empty_project_document(CreateProjectRequest(name="P", bt_number="BT-1", cert_programs=[]))
    element = ApertureElement(
        id="aptel_A1",
        name="One",
        row_span=(0, 0),
        column_span=(0, 0),
        frames=ApertureElementFrames(top=frame, right=frame, bottom=frame, left=frame),
        glazing=None,
    )
    aperture = ApertureTypeEntry(
        id="apt_A",
        name="Type A",
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[element],
    )
    return body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": [aperture]})})


def _apply(body: ProjectDocumentV1, command: RefreshRefFromCatalog) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_aperture_command(
        body,
        command,
        actor_user_id="user-1",
        catalog=_catalog(),
    )


def test_take_catalog_values_overwrite_ref() -> None:
    body = _body_with_frame(_frame(u=1.0))
    next_body, _audit = _apply(
        body,
        RefreshRefFromCatalog(
            aperture_type_id="apt_A",
            element_id="aptel_A1",
            target="frame.top",
            chosen_values={"u_value_w_m2k": 1.4},
        ),
    )
    top = next_body.tables.apertures[0].elements[0].frames.top
    assert top is not None
    assert top.u_value_w_m2k == 1.4


def test_synced_at_advances_to_now() -> None:
    body = _body_with_frame(_frame())
    before = datetime.now(tz=UTC)
    next_body, _audit = _apply(
        body,
        RefreshRefFromCatalog(
            aperture_type_id="apt_A",
            element_id="aptel_A1",
            target="frame.top",
            chosen_values={"u_value_w_m2k": 1.1},
        ),
    )
    top = next_body.tables.apertures[0].elements[0].frames.top
    assert top is not None and top.catalog_origin is not None
    assert top.catalog_origin.synced_at >= before


def test_local_overrides_preserved_verbatim() -> None:
    body = _body_with_frame(_frame(local_overrides=["color"]))
    next_body, _audit = _apply(
        body,
        RefreshRefFromCatalog(
            aperture_type_id="apt_A",
            element_id="aptel_A1",
            target="frame.top",
            chosen_values={"u_value_w_m2k": 1.4},
        ),
    )
    top = next_body.tables.apertures[0].elements[0].frames.top
    assert top is not None and top.catalog_origin is not None
    assert top.catalog_origin.local_overrides == ["color"]


def test_invalid_third_value_raises_422() -> None:
    body = _body_with_frame(_frame())
    with pytest.raises(HTTPException) as exc:
        _apply(
            body,
            RefreshRefFromCatalog(
                aperture_type_id="apt_A",
                element_id="aptel_A1",
                target="frame.top",
                chosen_values={"u_value_w_m2k": -1.0},
            ),
        )
    assert exc.value.status_code == 422
    detail = cast(dict[str, object], exc.value.detail)
    assert detail["error_code"] == "aperture_refresh_invalid_value"


def test_audit_marks_thermal_change_affects_u_value_true() -> None:
    body = _body_with_frame(_frame())
    _next, audit = _apply(
        body,
        RefreshRefFromCatalog(
            aperture_type_id="apt_A",
            element_id="aptel_A1",
            target="frame.top",
            chosen_values={"u_value_w_m2k": 1.4},
        ),
    )
    payload = cast(dict[str, object], audit["payload"])
    assert payload["affects_u_value"] is True


def test_audit_marks_cosmetic_change_affects_u_value_false() -> None:
    body = _body_with_frame(_frame())
    _next, audit = _apply(
        body,
        RefreshRefFromCatalog(
            aperture_type_id="apt_A",
            element_id="aptel_A1",
            target="frame.top",
            chosen_values={"color": "#aabbcc"},
        ),
    )
    payload = cast(dict[str, object], audit["payload"])
    assert payload["affects_u_value"] is False


def test_hand_entered_ref_rejected() -> None:
    body = _body_with_frame(FrameRef(name="HE", width_mm=80, u_value_w_m2k=1, psi_g_w_mk=0.04))
    with pytest.raises(HTTPException) as exc:
        _apply(
            body,
            RefreshRefFromCatalog(
                aperture_type_id="apt_A",
                element_id="aptel_A1",
                target="frame.top",
                chosen_values={"u_value_w_m2k": 1.2},
            ),
        )
    detail = cast(dict[str, object], exc.value.detail)
    assert detail["error_code"] == "aperture_refresh_not_catalog_sourced"
