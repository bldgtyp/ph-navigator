"""Default-aperture factory.

The Aperture Builder never starts an element from "no frame" — every new
type bookshelf-copies a known-default catalog frame into all four sides
and a known-default catalog glazing into the centre. The two defaults
(`PHN-Default-Frame`, `PHN-Default-Glass`) are seeded by Alembic
alongside the catalog tables; if either is missing at creation time the
factory raises a structured error so the route layer reports a 503
rather than letting the picker show a confusing "null frame" element.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Protocol

from features.project_document.apertures._ref_helpers import (
    bookshelf_copy_frame,
    bookshelf_copy_glazing,
    ensure_project_frame,
    ensure_project_glazing,
)
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentTables,
)
from features.shared.errors import api_error


class DefaultsCatalogReader(Protocol):
    """Read-only seam used by the factory and the picker-default flows.

    Returning ``None`` means "the seeded default row is missing" — the
    factory will raise `aperture_default_refs_missing` so the operator
    can re-run the seed migration before continuing.
    """

    def get_default_frame(self) -> FrameRef | None: ...

    def get_default_glazing(self) -> GlazingRef | None: ...


def build_default_aperture_type(
    catalog: DefaultsCatalogReader,
    *,
    tables: ProjectDocumentTables,
    name: str,
    aperture_id: str | None = None,
) -> ApertureTypeEntry:
    """Build a 1x1 default aperture, bookshelf-copying both defaults.

    Every catalog-origin on the returned refs carries
    ``catalog_schema_version=1`` — Phase 01 commits to that hook so
    later drift detection can compare schema versions without
    inspecting the rest of the origin.
    """

    frame = catalog.get_default_frame()
    if frame is None:
        raise api_error(
            503,
            "aperture_default_refs_missing",
            "Default frame catalog row is not seeded; re-run the catalog seed migration.",
            {"missing_catalog_table": "frame_types", "expected_name": APERTURE_DEFAULT_FRAME_NAME},
        )
    glazing = catalog.get_default_glazing()
    if glazing is None:
        raise api_error(
            503,
            "aperture_default_refs_missing",
            "Default glazing catalog row is not seeded; re-run the catalog seed migration.",
            {"missing_catalog_table": "glazing_types", "expected_name": APERTURE_DEFAULT_GLAZING_NAME},
        )

    now = datetime.now(tz=UTC)
    frame_copy = bookshelf_copy_frame(frame, synced_at=now)
    glazing_copy = bookshelf_copy_glazing(glazing, synced_at=now)
    assert glazing_copy is not None  # glazing was not-None above; helper passes through
    frame_id = ensure_project_frame(tables, frame_copy)
    glazing_id = ensure_project_glazing(tables, glazing_copy)

    aperture_id_final = aperture_id or f"apt_{_short_uuid()}"
    element_id = f"aptel_{_short_uuid()}"

    return ApertureTypeEntry(
        id=aperture_id_final,
        name=name,
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
        elements=[
            ApertureElement(
                id=element_id,
                name="Unnamed",
                row_span=(0, 0),
                column_span=(0, 0),
                frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
                glazing_id=glazing_id,
                operation=None,
            )
        ],
    )


def _short_uuid() -> str:
    return uuid.uuid4().hex[:12]
