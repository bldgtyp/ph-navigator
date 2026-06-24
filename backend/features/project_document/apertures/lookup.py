"""Lookup helpers for flat aperture frame/glazing project entities."""

from __future__ import annotations

from features.project_document.document import (
    ProjectDocumentTables,
    ProjectFrame,
    ProjectGlazing,
)


def frame_by_id(tables: ProjectDocumentTables, frame_id: str | None) -> ProjectFrame | None:
    if frame_id is None:
        return None
    for frame in tables.project_frames:
        if frame.id == frame_id:
            return frame
    return None


def glazing_by_id(tables: ProjectDocumentTables, glazing_id: str | None) -> ProjectGlazing | None:
    if glazing_id is None:
        return None
    for glazing in tables.project_glazings:
        if glazing.id == glazing_id:
            return glazing
    return None
