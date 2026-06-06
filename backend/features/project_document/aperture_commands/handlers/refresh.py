"""``refreshRefFromCatalog`` handler.

Applies the user's per-field choices from the refresh dialog to a single
``FrameRef`` / ``GlazingRef`` slot. The dialog has already resolved the
three-way choice (take catalog / keep mine / edit) into a single value
per ``field_key``; the handler:

  - patches each chosen value through Pydantic's per-field validator,
    rejecting third-value edits that violate the schema (e.g. negative
    ``u_value_w_m2k``);
  - advances ``catalog_origin.synced_at`` to now;
  - preserves ``catalog_origin.local_overrides`` verbatim (PRD §15 v1
    decision — refresh does not silently demote an existing override).

Audit ``affects_u_value=True`` whenever the chosen values touch any
thermal field, mirroring the Phase 09 cache skip-list.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TypeVar

from starlette import status

from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    RefreshRefFromCatalog,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)
from features.shared.errors import api_error

_FRAME_SIDES = ("top", "right", "bottom", "left")
_THERMAL_FIELDS = frozenset({"u_value_w_m2k", "g_value", "width_mm", "psi_g_w_mk", "psi_install_w_mk"})
_RefT = TypeVar("_RefT", FrameRef, GlazingRef)


def apply_refresh_ref_from_catalog(
    body: ProjectDocumentV1,
    command: RefreshRefFromCatalog,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    target = command.target

    if target == "glazing":
        current = element.glazing
        if current is None:
            raise _target_unset_error(element.id, target)
        next_ref = _apply_chosen(current, command.chosen_values)
        next_element = element.model_copy(update={"glazing": next_ref})
    else:
        side = target.split(".", 1)[1]
        if side not in _FRAME_SIDES:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_refresh_target_invalid",
                "Unknown refresh target side.",
                {"target": target},
            )
        current_frame: FrameRef | None = getattr(element.frames, side)
        if current_frame is None:
            raise _target_unset_error(element.id, target)
        next_ref = _apply_chosen(current_frame, command.chosen_values)
        next_frames = element.frames.model_copy(update={side: next_ref})
        next_element = element.model_copy(update={"frames": next_frames})

    next_body = _replace_element(body, aperture_idx, aperture, element_idx, next_element)
    return next_body, _audit(
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        target=target,
        field_keys=sorted(command.chosen_values.keys()),
        affects_u_value=any(k in _THERMAL_FIELDS for k in command.chosen_values),
    )


def _apply_chosen(ref: _RefT, chosen_values: Mapping[str, object]) -> _RefT:
    if ref.catalog_origin is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_refresh_not_catalog_sourced",
            "Cannot refresh a hand-entered ref — repick from the catalog instead.",
            {"name": ref.name},
        )
    for field_key in chosen_values:
        if field_key == "catalog_origin":
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_refresh_field_protected",
                "catalog_origin is not refreshable through refreshRefFromCatalog.",
                {"field_key": field_key},
            )
        if field_key not in type(ref).model_fields:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_refresh_unknown_field",
                "Unknown field on the target ref.",
                {"field_key": field_key, "ref_type": type(ref).__name__},
            )
    update = dict(chosen_values)
    try:
        patched = ref.model_copy(update=update)
        next_ref = type(ref).model_validate(patched.model_dump(mode="json"))
    except (ValueError, TypeError) as exc:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_refresh_invalid_value",
            f"Chosen value rejected by field validator: {exc}",
            {"chosen_keys": sorted(chosen_values.keys())},
        ) from exc

    refreshed_origin = next_ref.catalog_origin
    assert refreshed_origin is not None
    refreshed_origin = refreshed_origin.model_copy(update={"synced_at": datetime.now(tz=UTC)})
    return next_ref.model_copy(update={"catalog_origin": refreshed_origin})


def _target_unset_error(element_id: str, target: str) -> Exception:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "aperture_refresh_target_unset",
        "Cannot refresh a slot that has not been picked yet.",
        {"element_id": element_id, "target": target},
    )


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


def _audit(actor_user_id: str, **payload: object) -> dict[str, object]:
    return {
        "action_kind": AUDIT_KIND_BY_APERTURE_COMMAND["refreshRefFromCatalog"],
        "actor_user_id": actor_user_id,
        "payload": payload,
    }
