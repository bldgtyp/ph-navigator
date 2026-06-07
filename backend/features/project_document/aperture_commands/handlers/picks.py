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
)
from features.project_document.aperture_commands.models import (
    PickFrame,
    PickGlazing,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
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
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    _require_catalog_origin(command.frame, "frame")
    frame_ref = _stamp_synced_at(command.frame)
    frame_origin = frame_ref.catalog_origin
    if frame_origin is None:
        raise AssertionError("catalog origin is required after stamping a picked frame ref")
    next_frames = element.frames.model_copy(update={command.side: frame_ref})
    next_element = element.model_copy(update={"frames": next_frames})
    next_body = replace_element(body, aperture_idx, aperture, element_idx, next_element)
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
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    _require_catalog_origin(command.glazing, "glazing")
    glazing_ref = _stamp_synced_at(command.glazing)
    glazing_origin = glazing_ref.catalog_origin
    if glazing_origin is None:
        raise AssertionError("catalog origin is required after stamping a picked glazing ref")
    next_element = element.model_copy(update={"glazing": glazing_ref})
    next_body = replace_element(body, aperture_idx, aperture, element_idx, next_element)
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


def _require_catalog_origin(ref: FrameRef | GlazingRef, target: str) -> None:
    if ref.catalog_origin is not None:
        return
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "aperture_pick_catalog_required",
        "Aperture frame and glazing picks must come from the catalog.",
        {"target": target},
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
