"""Project glazing/frame documentation command handlers."""

from __future__ import annotations

from typing import Any, NoReturn, TypeVar

from starlette import status

from features.envelope.models import (
    RemoveProjectFrameCommand,
    RemoveProjectGlazingCommand,
    UpdateProjectFrameCommand,
    UpdateProjectGlazingCommand,
)
from features.project_document.document import ProjectDocumentV1, ProjectFrame, ProjectGlazing
from features.project_document.service import validate_document
from features.shared.errors import api_error

_EntityT = TypeVar("_EntityT", ProjectFrame, ProjectGlazing)

_FRAME_SIDES = ("top", "right", "bottom", "left")
_PROJECT_GLAZING_OVERRIDE_FIELDS = frozenset(
    {
        "name",
        "manufacturer",
        "brand",
        "suffix",
        "u_value_w_m2k",
        "g_value",
        "color",
        "source",
        "comments",
    }
)
_PROJECT_FRAME_OVERRIDE_FIELDS = frozenset(
    {
        "name",
        "manufacturer",
        "brand",
        "use",
        "operation",
        "location",
        "mull_type",
        "prefix",
        "suffix",
        "material",
        "width_mm",
        "u_value_w_m2k",
        "psi_g_w_mk",
        "psi_install_w_mk",
        "color",
        "source",
        "comments",
    }
)


def update_project_glazing(body: ProjectDocumentV1, command: UpdateProjectGlazingCommand) -> ProjectDocumentV1:
    changed = command.model_dump(exclude_unset=True, exclude={"kind", "project_glazing_id"})
    if not changed:
        _find_entity(body.tables.project_glazings, command.project_glazing_id, "project_glazing")
        return body
    glazings = _replace_entity(
        body.tables.project_glazings,
        command.project_glazing_id,
        "project_glazing",
        changed,
    )
    return _replace_project_glazings(body, glazings)


def update_project_frame(body: ProjectDocumentV1, command: UpdateProjectFrameCommand) -> ProjectDocumentV1:
    changed = command.model_dump(exclude_unset=True, exclude={"kind", "project_frame_id"})
    if not changed:
        _find_entity(body.tables.project_frames, command.project_frame_id, "project_frame")
        return body
    frames = _replace_entity(
        body.tables.project_frames,
        command.project_frame_id,
        "project_frame",
        changed,
    )
    return _replace_project_frames(body, frames)


def remove_project_glazing(body: ProjectDocumentV1, command: RemoveProjectGlazingCommand) -> ProjectDocumentV1:
    _find_entity(body.tables.project_glazings, command.project_glazing_id, "project_glazing")
    if command.project_glazing_id in _used_project_glazing_ids(body):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_glazing_in_use",
            "Only unused project glazings can be removed.",
            {"project_glazing_id": command.project_glazing_id},
        )
    return _replace_project_glazings(
        body,
        [glazing for glazing in body.tables.project_glazings if glazing.id != command.project_glazing_id],
    )


def remove_project_frame(body: ProjectDocumentV1, command: RemoveProjectFrameCommand) -> ProjectDocumentV1:
    _find_entity(body.tables.project_frames, command.project_frame_id, "project_frame")
    if command.project_frame_id in _used_project_frame_ids(body):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_frame_in_use",
            "Only unused project frames can be removed.",
            {"project_frame_id": command.project_frame_id},
        )
    return _replace_project_frames(
        body,
        [frame for frame in body.tables.project_frames if frame.id != command.project_frame_id],
    )


def _replace_entity(
    rows: list[_EntityT],
    entity_id: str,
    entity_name: str,
    changed: dict[str, Any],
) -> list[_EntityT]:
    next_rows: list[_EntityT] = []
    found = False
    for row in rows:
        if row.id != entity_id:
            next_rows.append(row)
            continue
        found = True
        next_rows.append(row.model_copy(update=_changed_values(row, changed)))
    if not found:
        _not_found(entity_name, entity_id)
    return next_rows


def _changed_values(row: ProjectFrame | ProjectGlazing, changed: dict[str, Any]) -> dict[str, Any]:
    update_values = dict(changed)
    origin = row.catalog_origin
    if origin is None:
        return update_values
    overrides = set(origin.local_overrides)
    override_fields = (
        _PROJECT_FRAME_OVERRIDE_FIELDS if isinstance(row, ProjectFrame) else _PROJECT_GLAZING_OVERRIDE_FIELDS
    )
    for field_name, value in changed.items():
        if field_name in override_fields and getattr(row, field_name) != value:
            overrides.add(field_name)
    update_values["catalog_origin"] = origin.model_copy(update={"local_overrides": sorted(overrides)})
    return update_values


def _replace_project_glazings(body: ProjectDocumentV1, glazings: list[ProjectGlazing]) -> ProjectDocumentV1:
    if glazings == body.tables.project_glazings:
        return body
    raw = body.model_dump(mode="json")
    raw["tables"]["project_glazings"] = [glazing.model_dump(mode="json") for glazing in glazings]
    return validate_document(raw)


def _replace_project_frames(body: ProjectDocumentV1, frames: list[ProjectFrame]) -> ProjectDocumentV1:
    if frames == body.tables.project_frames:
        return body
    raw = body.model_dump(mode="json")
    raw["tables"]["project_frames"] = [frame.model_dump(mode="json") for frame in frames]
    return validate_document(raw)


def _find_entity(rows: list[_EntityT], entity_id: str, entity_name: str) -> _EntityT:
    for row in rows:
        if row.id == entity_id:
            return row
    _not_found(entity_name, entity_id)


def _not_found(entity_name: str, entity_id: str) -> NoReturn:
    raise api_error(
        status.HTTP_409_CONFLICT,
        f"{entity_name}_not_found",
        f"The {entity_name.replace('_', ' ')} was not found.",
        {f"{entity_name}_id": entity_id},
    )


def _used_project_glazing_ids(body: ProjectDocumentV1) -> set[str]:
    return {
        element.glazing_id
        for aperture in body.tables.apertures
        for element in aperture.elements
        if element.glazing_id is not None
    }


def _used_project_frame_ids(body: ProjectDocumentV1) -> set[str]:
    return {
        frame_id
        for aperture in body.tables.apertures
        for element in aperture.elements
        for frame_id in (getattr(element.frames, side) for side in _FRAME_SIDES)
        if frame_id is not None
    }


__all__ = [
    "remove_project_frame",
    "remove_project_glazing",
    "update_project_frame",
    "update_project_glazing",
]
