"""Pick handlers: pickFrame and pickGlazing.

The pick commands replace an element's per-side frame or its glazing
ref. Both wire shapes carry the full ref payload — the frontend resolves
the catalog row to a ``FrameRef`` / ``GlazingRef`` before dispatch, so
the handler is a structural mutation plus a ``synced_at`` refresh on
``catalog_origin``. Picks must be catalog-sourced; local hand-entered
refs are rejected so aperture frame/glazing data stays catalog-managed.

Both handlers re-run the document validator at the dispatcher seam so
the ``FrameRef`` / ``GlazingRef`` model validators (incl. catalog origin
family check) fire on every commit.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TypeVar

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_element,
    find_entry,
    replace_element,
    require_glazed_element,
)
from features.project_document.aperture_commands.models import (
    PickFrame,
    PickGlazing,
)
from features.project_document.apertures._ref_helpers import ensure_project_frame, ensure_project_glazing
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)
from features.shared.errors import api_error

_RefT = TypeVar("_RefT", FrameRef, GlazingRef)


def apply_pick_frame(
    body: ProjectDocumentV1,
    command: PickFrame,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    require_glazed_element(element, action="pickFrame")
    frame_origin = _require_catalog_origin(command.frame, "frame")
    _require_catalog_row_exists(catalog, "frame", frame_origin.catalog_record_id)
    frame_ref = _stamp_synced_at(command.frame)
    next_tables = body.tables.model_copy(deep=True)
    frame_id = ensure_project_frame(next_tables, frame_ref)
    next_frames = element.frames.model_copy(update={command.side: frame_id})
    frame_changed = getattr(element.frames, command.side) != frame_id
    frame_updates: dict[str, object] = {"frames": next_frames}
    if frame_changed:
        frame_updates["nfrc_whole_window_u_w_m2k"] = None
        frame_updates["nfrc_standard_size_note"] = None
    next_element = element.model_copy(update=frame_updates)
    next_body = replace_element(
        body.model_copy(update={"tables": next_tables}), aperture_idx, aperture, element_idx, next_element
    )
    return next_body, build_audit(
        "pickFrame",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        side=command.side,
        catalog_record_id=frame_origin.catalog_record_id,
        hand_enter=False,
        affects_u_value=True,
    )


def apply_pick_glazing(
    body: ProjectDocumentV1,
    command: PickGlazing,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    require_glazed_element(element, action="pickGlazing")
    glazing_origin = _require_catalog_origin(command.glazing, "glazing")
    _require_catalog_row_exists(catalog, "glazing", glazing_origin.catalog_record_id)
    glazing_ref = _stamp_synced_at(command.glazing)
    next_tables = body.tables.model_copy(deep=True)
    glazing_id = ensure_project_glazing(next_tables, glazing_ref)
    glazing_changed = element.glazing_id != glazing_id
    glazing_updates: dict[str, object] = {"glazing_id": glazing_id}
    if glazing_changed:
        glazing_updates["nfrc_whole_window_u_w_m2k"] = None
        glazing_updates["nfrc_standard_size_note"] = None
    next_element = element.model_copy(update=glazing_updates)
    next_body = replace_element(
        body.model_copy(update={"tables": next_tables}), aperture_idx, aperture, element_idx, next_element
    )
    return next_body, build_audit(
        "pickGlazing",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        catalog_record_id=glazing_origin.catalog_record_id,
        hand_enter=False,
        affects_u_value=True,
    )


# ---- Helpers --------------------------------------------------------------


def _require_catalog_origin(ref: FrameRef | GlazingRef, target: str) -> CatalogOrigin:
    if ref.catalog_origin is not None:
        return ref.catalog_origin
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "aperture_pick_catalog_required",
        "Aperture frame and glazing picks must come from the catalog.",
        {"target": target},
    )


def _require_catalog_row_exists(catalog: DefaultsCatalogReader, target: str, record_id: str) -> None:
    exists = catalog.frame_exists(record_id) if target == "frame" else catalog.glazing_exists(record_id)
    if exists:
        return
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "aperture_pick_catalog_row_not_found",
        f"Referenced {target} catalog row does not exist: {record_id}",
        {"target": target, "catalog_record_id": record_id},
    )


def _stamp_synced_at(ref: _RefT) -> _RefT:
    """Refresh ``synced_at`` and reset ``local_overrides`` on a freshly
    picked catalog ref. Hand-entered refs (null origin) round-trip.

    Unlike :func:`apertures._ref_helpers.reset_origin`, this preserves
    the source's ``catalog_schema_version`` when non-zero — the pick
    can originate from a catalog row pinned to an older schema and
    we should not silently bump it.
    """

    origin = ref.catalog_origin
    if origin is None:
        raise AssertionError("catalog origin is required before stamping a picked aperture ref")
    refreshed = origin.model_copy(
        update={
            "synced_at": datetime.now(tz=UTC),
            "local_overrides": [],
            "catalog_schema_version": origin.catalog_schema_version or 1,
        }
    )
    return ref.model_copy(update={"catalog_origin": refreshed})


__all__ = ["apply_pick_frame", "apply_pick_glazing"]
