"""Shared lookup / replace / audit helpers for every aperture command handler.

The 13-phase Apertures build duplicated these five helpers across eight
handler modules. They are now the single canonical implementation; every
handler must use these and not redefine them. ``build_audit`` always
takes the command ``kind`` so the persisted audit-log payload is
consistent across handlers.
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.models import (
    AUDIT_KIND_BY_APERTURE_COMMAND,
)
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def find_entry(
    body: ProjectDocumentV1,
    aperture_type_id: str,
) -> tuple[int, ApertureTypeEntry]:
    for idx, entry in enumerate(body.tables.apertures):
        if entry.id == aperture_type_id:
            return idx, entry
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "aperture_type_not_found",
        "No aperture type matches the requested id.",
        {"aperture_type_id": aperture_type_id},
    )


def find_element(
    entry: ApertureTypeEntry,
    element_id: str,
) -> tuple[int, ApertureElement]:
    for idx, el in enumerate(entry.elements):
        if el.id == element_id:
            return idx, el
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "aperture_element_not_found",
        "No aperture element matches the requested id.",
        {"aperture_type_id": entry.id, "element_id": element_id},
    )


def find_elements(
    entry: ApertureTypeEntry,
    element_ids: list[str],
) -> list[tuple[int, ApertureElement]]:
    """Resolve a batch before mutation so missing ids fail atomically."""
    by_id = {element.id: (index, element) for index, element in enumerate(entry.elements)}
    missing_ids = list(dict.fromkeys(element_id for element_id in element_ids if element_id not in by_id))
    if missing_ids:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_element_not_found",
            "One or more aperture elements were not found.",
            {"aperture_type_id": entry.id, "missing_ids": missing_ids},
        )
    return [by_id[element_id] for element_id in element_ids]


def replace_aperture(
    body: ProjectDocumentV1,
    aperture_idx: int,
    entry: ApertureTypeEntry,
) -> ProjectDocumentV1:
    apertures = list(body.tables.apertures)
    apertures[aperture_idx] = entry
    return body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": apertures})})


def replace_element(
    body: ProjectDocumentV1,
    aperture_idx: int,
    aperture: ApertureTypeEntry,
    element_idx: int,
    element: ApertureElement,
) -> ProjectDocumentV1:
    next_elements = list(aperture.elements)
    next_elements[element_idx] = element
    next_aperture = aperture.model_copy(update={"elements": next_elements})
    return replace_aperture(body, aperture_idx, next_aperture)


def require_glazed_element(element: ApertureElement, *, action: str) -> None:
    """Reject assignment edits that are meaningless for a void element."""
    if element.kind == "glazed":
        return
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "aperture_element_is_void",
        "Empty aperture elements cannot carry window assignments.",
        {"element_id": element.id, "action": action},
    )


def build_audit(kind: str, actor_user_id: str, **payload: object) -> dict[str, object]:
    return {
        "action_kind": AUDIT_KIND_BY_APERTURE_COMMAND[kind],
        "actor_user_id": actor_user_id,
        "payload": payload,
    }
