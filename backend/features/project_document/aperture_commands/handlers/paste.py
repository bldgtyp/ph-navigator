"""Paste-assignment handler — copies the 6 assignment fields from
``source_element_id`` onto every ``target_element_ids[i]`` inside the
same aperture type. ``id``, ``row_span``, ``column_span``, and
``name`` on each target are preserved; only the assignment payload
(operation, glazing, four frames) is replaced.

A single command writes all targets atomically inside one
``model_copy`` chain so partial failures leave the document
unchanged. Refs are deep-copied so the targets don't share Pydantic
instances with the source (avoids accidental mutation if a later
override edits one target). The optional ``restore_assignment`` snapshot
is the builder's single-target Undo path; it restores the prior wire ids
without pretending that the target is a separate source element.
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_elements,
    find_entry,
    replace_aperture,
    require_glazed_element,
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
    if command.restore_assignment is not None:
        if len(command.target_element_ids) != 1:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "aperture_paste_restore_requires_one_target",
                "Paste undo can restore exactly one target element.",
                {"target_element_ids": list(command.target_element_ids)},
            )
        if command.source_element_id != command.target_element_ids[0]:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "aperture_paste_restore_requires_self_target",
                "Paste undo must identify its target as the source element.",
                {
                    "source_element_id": command.source_element_id,
                    "target_element_id": command.target_element_ids[0],
                },
            )
        ((target_idx, target),) = find_elements(entry, command.target_element_ids)
        require_glazed_element(target, action="pasteAssignmentRestore")
        snapshot = command.restore_assignment
        restored = target.model_copy(
            update={
                "operation": snapshot.operation.model_copy(deep=True) if snapshot.operation else None,
                "glazing_id": snapshot.glazing_id,
                "frames": snapshot.frames.model_copy(deep=True),
            }
        )
        next_elements = list(entry.elements)
        next_elements[target_idx] = restored
        next_entry = entry.model_copy(update={"elements": next_elements})
        next_body = replace_aperture(body, aperture_idx, next_entry)
        return next_body, build_audit(
            "pasteAssignment",
            actor_user_id,
            aperture_type_id=entry.id,
            source_element_id=command.source_element_id,
            target_element_ids=list(command.target_element_ids),
            restore=True,
            affects_u_value=True,
        )

    resolved = find_elements(
        entry,
        [command.source_element_id, *command.target_element_ids],
    )
    _, source = resolved[0]
    targets = resolved[1:]
    if command.source_element_id in command.target_element_ids:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_paste_target_is_source",
            "A paste target may not be the source element.",
            {"source_element_id": command.source_element_id},
        )

    require_glazed_element(source, action="pasteAssignmentSource")
    for _, target in targets:
        require_glazed_element(target, action="pasteAssignmentTarget")

    next_elements = list(entry.elements)
    for idx, target in targets:
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
