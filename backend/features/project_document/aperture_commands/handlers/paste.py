"""Paste-assignment handler — copies the 6 assignment fields from
``source_element_id`` onto every ``target_element_ids[i]`` inside the
same aperture type. ``id``, ``row_span``, ``column_span``, and
``name`` on each target are preserved; only the assignment payload
(operation, glazing, four frames) is replaced.

A single command writes all targets atomically inside one
``model_copy`` chain so partial failures leave the document
unchanged. Refs are deep-copied so the targets don't share Pydantic
instances with the source (avoids accidental mutation if a later
override edits one target).
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_entry,
    replace_aperture,
)
from features.project_document.aperture_commands.models import PasteAssignment
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error


def apply_paste_assignment(
    body: ProjectDocumentV1,
    command: PasteAssignment,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    by_id = {el.id: (i, el) for i, el in enumerate(entry.elements)}

    if command.source_element_id not in by_id:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_element_not_found",
            "Paste source element was not found in the aperture type.",
            {
                "aperture_type_id": entry.id,
                "source_element_id": command.source_element_id,
            },
        )
    missing_targets = [tid for tid in command.target_element_ids if tid not in by_id]
    if missing_targets:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_element_not_found",
            "One or more paste targets were not found in the aperture type.",
            {"aperture_type_id": entry.id, "missing_ids": missing_targets},
        )
    if command.source_element_id in command.target_element_ids:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_paste_target_is_source",
            "A paste target may not be the source element.",
            {"source_element_id": command.source_element_id},
        )

    _, source = by_id[command.source_element_id]
    next_elements = list(entry.elements)
    for target_id in command.target_element_ids:
        idx, target = by_id[target_id]
        next_elements[idx] = target.model_copy(
            update={
                "operation": source.operation.model_copy(deep=True) if source.operation else None,
                "glazing_id": source.glazing_id,
                "frames": source.frames.model_copy(deep=True),
            }
        )

    next_entry = entry.model_copy(update={"elements": next_elements})
    next_body = replace_aperture(body, aperture_idx, next_entry)

    return next_body, build_audit(
        "pasteAssignment",
        actor_user_id,
        aperture_type_id=entry.id,
        source_element_id=command.source_element_id,
        target_element_ids=list(command.target_element_ids),
        affects_u_value=True,
    )


__all__ = ["apply_paste_assignment"]
