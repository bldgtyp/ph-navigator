"""Per-element handlers: name and operation.

These two land in Phase 01 because the tracer-bullet sidebar already
exposes element-name editing as part of the per-element card; the
operation editor (Phase 07) consumes ``setElementOperation`` later but
the wire shape is fixed here so the MCP surface doesn't churn.
"""

from __future__ import annotations

from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
    SetElementName,
    SetElementOperation,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def apply_set_element_name(
    body: ProjectDocumentV1,
    command: SetElementName,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    new_name = command.new_name.strip()
    if not new_name:
        raise api_error(
            422,
            "aperture_element_name_empty",
            "Aperture element name must not be empty.",
            {"element_id": element.id},
        )
    updated = element.model_copy(update={"name": new_name})
    next_body = _replace_element(body, aperture_idx, aperture, element_idx, updated)
    return next_body, _audit(
        "setElementName",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        previous_name=element.name,
        new_name=updated.name,
    )


def apply_set_element_operation(
    body: ProjectDocumentV1,
    command: SetElementOperation,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, element_idx, aperture, element = _resolve(body, command.aperture_type_id, command.element_id)
    updated = element.model_copy(update={"operation": command.operation})
    next_body = _replace_element(body, aperture_idx, aperture, element_idx, updated)
    op_payload = command.operation.model_dump(mode="json") if command.operation is not None else None
    return next_body, _audit(
        "setElementOperation",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        operation=op_payload,
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
            404,
            "aperture_element_not_found",
            "No aperture element matches the requested id.",
            {"aperture_type_id": aperture_type_id, "element_id": element_id},
        )
    raise api_error(
        404,
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
