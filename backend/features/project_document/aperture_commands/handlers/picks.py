"""Pick and override handlers: pickFrame, pickGlazing, editFieldOverride.

The pick commands replace an element's per-side frame or its glazing
ref. Both wire shapes carry the full ref payload — the frontend resolves
the catalog row to a ``FrameRef`` / ``GlazingRef`` before dispatch, so
the handler is a structural mutation plus a ``synced_at`` refresh on
``catalog_origin``. Hand-entered picks arrive with ``catalog_origin =
None`` and are written through unchanged.

``editFieldOverride`` patches one field on a target ref and, when the
target is catalog-sourced, appends the edited ``field_key`` to
``catalog_origin.local_overrides`` (deduped, first-edit ordering
preserved). Hand-entered refs accept the edit without touching
``local_overrides``.

All three handlers re-run the document validator at the dispatcher seam
so the ``FrameRef`` / ``GlazingRef`` model validators (incl. catalog
origin family check) fire on every commit.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TypeVar

from starlette import status

from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    EditFieldOverride,
    PickFrame,
    PickGlazing,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)
from features.shared.errors import api_error

_FRAME_SIDES = ("top", "right", "bottom", "left")
_RefT = TypeVar("_RefT", FrameRef, GlazingRef)


def apply_pick_frame(
    body: ProjectDocumentV1,
    command: PickFrame,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    frame_ref = _stamp_synced_at(command.frame)
    next_frames = element.frames.model_copy(update={command.side: frame_ref})
    next_element = element.model_copy(update={"frames": next_frames})
    next_body = _replace_element(body, aperture_idx, aperture, element_idx, next_element)
    return next_body, _audit(
        "pickFrame",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        side=command.side,
        catalog_record_id=(frame_ref.catalog_origin.catalog_record_id if frame_ref.catalog_origin else None),
        hand_enter=frame_ref.catalog_origin is None,
        affects_u_value=True,
    )


def apply_pick_glazing(
    body: ProjectDocumentV1,
    command: PickGlazing,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    glazing_ref = _stamp_synced_at(command.glazing)
    next_element = element.model_copy(update={"glazing": glazing_ref})
    next_body = _replace_element(body, aperture_idx, aperture, element_idx, next_element)
    return next_body, _audit(
        "pickGlazing",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        catalog_record_id=(glazing_ref.catalog_origin.catalog_record_id if glazing_ref.catalog_origin else None),
        hand_enter=glazing_ref.catalog_origin is None,
        affects_u_value=True,
    )


def apply_edit_field_override(
    body: ProjectDocumentV1,
    command: EditFieldOverride,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    target = command.target
    if target == "glazing":
        current = element.glazing
        if current is None:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_override_target_unset",
                "Cannot override a field on a glazing slot that has not been picked yet.",
                {"element_id": element.id, "target": target},
            )
        next_ref = _apply_override(current, command.field_key, command.new_value)
        next_element = element.model_copy(update={"glazing": next_ref})
    else:
        side = target.split(".", 1)[1]
        if side not in _FRAME_SIDES:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_override_target_invalid",
                "Unknown override target side.",
                {"target": target},
            )
        current_frame: FrameRef | None = getattr(element.frames, side)
        if current_frame is None:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_override_target_unset",
                "Cannot override a field on a frame slot that has not been picked yet.",
                {"element_id": element.id, "target": target},
            )
        next_ref = _apply_override(current_frame, command.field_key, command.new_value)
        next_frames = element.frames.model_copy(update={side: next_ref})
        next_element = element.model_copy(update={"frames": next_frames})

    next_body = _replace_element(body, aperture_idx, aperture, element_idx, next_element)
    return next_body, _audit(
        "editFieldOverride",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        target=target,
        field_key=command.field_key,
        affects_u_value=command.field_key in {"u_value_w_m2k", "g_value", "width_mm", "psi_g_w_mk", "psi_install_w_mk"},
    )


# ---- Helpers --------------------------------------------------------------


def _stamp_synced_at(ref: _RefT) -> _RefT:
    """Refresh ``synced_at`` and reset ``local_overrides`` on a freshly
    picked catalog ref. Hand-entered refs (null origin) round-trip."""

    origin = ref.catalog_origin
    if origin is None:
        return ref
    refreshed = origin.model_copy(
        update={
            "synced_at": datetime.now(tz=UTC),
            "local_overrides": [],
            "catalog_schema_version": origin.catalog_schema_version or 1,
        }
    )
    return ref.model_copy(update={"catalog_origin": refreshed})


def _apply_override(ref: _RefT, field_key: str, new_value: object) -> _RefT:
    if field_key in {"catalog_origin", "name"}:
        # ``name`` is editable but is treated like any other field; the
        # ``catalog_origin`` field itself is not user-editable through
        # this command (use pickFrame / pickGlazing to swap origin).
        if field_key == "catalog_origin":
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_override_field_protected",
                "catalog_origin is not editable through editFieldOverride.",
                {"field_key": field_key},
            )
    if field_key not in type(ref).model_fields:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_override_unknown_field",
            "Unknown field on the target ref.",
            {"field_key": field_key, "ref_type": type(ref).__name__},
        )
    try:
        next_ref = ref.model_copy(update={field_key: new_value})
        # Re-validate via round-trip so per-field validators fire on the
        # patched ref (model_copy alone skips validators).
        next_ref = type(ref).model_validate(next_ref.model_dump(mode="json"))
    except (ValueError, TypeError) as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_override_invalid_value",
            f"New value rejected by field validator: {exc}",
            {"field_key": field_key},
        ) from exc

    origin: CatalogOrigin | None = next_ref.catalog_origin
    if origin is None:
        return next_ref
    if field_key in origin.local_overrides:
        # Already tracked — idempotent.
        return next_ref
    next_origin = origin.model_copy(update={"local_overrides": [*origin.local_overrides, field_key]})
    return next_ref.model_copy(update={"catalog_origin": next_origin})


def _resolve(
    body: ProjectDocumentV1,
    aperture_type_id: str,
    element_id: str,
) -> tuple[int, int, ApertureTypeEntry, ApertureElement]:
    for aperture_idx, aperture in enumerate(body.tables.apertures):
        if aperture.id != aperture_type_id:
            continue
        for element_idx, element in enumerate(aperture.elements):
            if element.id == element_id:
                return aperture_idx, element_idx, aperture, element
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_element_not_found",
            "No aperture element matches the requested id.",
            {"aperture_type_id": aperture_type_id, "element_id": element_id},
        )
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "aperture_type_not_found",
        "No aperture type matches the requested id.",
        {"aperture_type_id": aperture_type_id},
    )


def _replace_element(
    body: ProjectDocumentV1,
    aperture_idx: int,
    aperture: ApertureTypeEntry,
    element_idx: int,
    element: ApertureElement,
) -> ProjectDocumentV1:
    next_elements = list(aperture.elements)
    next_elements[element_idx] = element
    next_aperture = aperture.model_copy(update={"elements": next_elements})
    next_apertures = list(body.tables.apertures)
    next_apertures[aperture_idx] = next_aperture
    return body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": next_apertures})})


def _audit(kind: str, actor_user_id: str, **payload: object) -> dict[str, object]:
    return {
        "action_kind": AUDIT_KIND_BY_APERTURE_COMMAND[kind],
        "actor_user_id": actor_user_id,
        "payload": payload,
    }


__all__ = ["apply_pick_frame", "apply_pick_glazing", "apply_edit_field_override"]
