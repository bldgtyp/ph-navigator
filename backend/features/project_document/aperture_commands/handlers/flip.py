"""Persisted aperture mirroring commands."""

from __future__ import annotations

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_entry,
    replace_aperture,
)
from features.project_document.aperture_commands.models import FlipLeftRight
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureOperation,
    ApertureOperationDirection,
    ProjectDocumentV1,
)


def apply_flip_left_right(
    body: ProjectDocumentV1,
    command: FlipLeftRight,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    column_count = len(entry.column_widths_mm)
    next_elements = [_flip_element(element, column_count) for element in entry.elements]
    next_entry = entry.model_copy(
        update={
            "column_widths_mm": list(reversed(entry.column_widths_mm)),
            "elements": next_elements,
        }
    )
    next_body = replace_aperture(body, aperture_idx, next_entry)

    return next_body, build_audit(
        "flipLeftRight",
        actor_user_id,
        aperture_type_id=entry.id,
        flipped_element_ids=[element.id for element in entry.elements],
        column_count=column_count,
        affects_u_value=True,
    )


def _flip_element(element: ApertureElement, column_count: int) -> ApertureElement:
    c0, c1 = element.column_span
    return element.model_copy(
        update={
            "column_span": (column_count - 1 - c1, column_count - 1 - c0),
            "frames": element.frames.model_copy(
                update={
                    "left": element.frames.right,
                    "right": element.frames.left,
                },
                deep=True,
            ),
            "operation": _flip_operation(element.operation),
        }
    )


def _flip_operation(operation: ApertureOperation | None) -> ApertureOperation | None:
    if operation is None:
        return None
    return operation.model_copy(
        update={"directions": [_flip_direction(direction) for direction in operation.directions]},
        deep=True,
    )


def _flip_direction(direction: ApertureOperationDirection) -> ApertureOperationDirection:
    if direction == "left":
        return "right"
    if direction == "right":
        return "left"
    return direction


__all__ = ["apply_flip_left_right"]
