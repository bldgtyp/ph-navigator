"""Walk every catalog-aware ref on every aperture element and report drift.

Drift in V2 is **field-delta only** — the legacy ``catalog_version_id``
layer is null on every new catalog (see ``document.CatalogOrigin``), so
the version-id-mismatch branch from the PRD collapses into the
field-delta branch. ``catalog_row_missing`` covers the catalog-row-
deleted edge case so the dialog can show the user a reason to repick.

Hand-entered refs (``catalog_origin == None``) are skipped — by
definition they are not drifted.
"""

from __future__ import annotations

from typing import Protocol

from features.aperture_drift.comparator import compare_frame_ref, compare_glazing_ref
from features.aperture_drift.models import (
    ApertureDriftEntry,
    ApertureDriftReport,
    DriftKind,
    DriftTarget,
    RefFieldDelta,
)
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
)


class CatalogRowReader(Protocol):
    """Two-getter contract: look up a row by record id.

    The route uses ``database.connection`` + the catalog repositories;
    tests use an in-memory stub so the detector stays pure.
    """

    def get_frame_type(self, record_id: str) -> dict[str, object] | None: ...

    def get_glazing_type(self, record_id: str) -> dict[str, object] | None: ...


def detect_aperture_drift(
    body: ProjectDocumentV1,
    catalog: CatalogRowReader,
) -> ApertureDriftReport:
    entries: list[ApertureDriftEntry] = []
    for aperture in body.tables.apertures:
        for element in aperture.elements:
            entries.extend(_check_element(aperture, element, catalog))
    return ApertureDriftReport(entries=entries)


def _check_element(
    aperture: ApertureTypeEntry,
    element: ApertureElement,
    catalog: CatalogRowReader,
) -> list[ApertureDriftEntry]:
    out: list[ApertureDriftEntry] = []
    for side in ("top", "right", "bottom", "left"):
        frame = getattr(element.frames, side)
        if frame is None or frame.catalog_origin is None:
            continue
        entry = _check_frame(aperture, element, side, frame, catalog)
        if entry is not None:
            out.append(entry)
    glazing = element.glazing
    if glazing is not None and glazing.catalog_origin is not None:
        entry = _check_glazing(aperture, element, glazing, catalog)
        if entry is not None:
            out.append(entry)
    return out


def _check_frame(
    aperture: ApertureTypeEntry,
    element: ApertureElement,
    side: str,
    frame: FrameRef,
    catalog: CatalogRowReader,
) -> ApertureDriftEntry | None:
    assert frame.catalog_origin is not None  # narrowed by caller
    record_id = frame.catalog_origin.catalog_record_id
    row = catalog.get_frame_type(record_id)
    target: DriftTarget = _frame_target(side)
    if row is None:
        return _entry(aperture, element, target, "catalog_row_missing", record_id, [])
    deltas = compare_frame_ref(frame, row)
    if not deltas:
        return None
    return _entry(aperture, element, target, "field_delta", record_id, deltas)


def _check_glazing(
    aperture: ApertureTypeEntry,
    element: ApertureElement,
    glazing: GlazingRef,
    catalog: CatalogRowReader,
) -> ApertureDriftEntry | None:
    assert glazing.catalog_origin is not None
    record_id = glazing.catalog_origin.catalog_record_id
    row = catalog.get_glazing_type(record_id)
    if row is None:
        return _entry(aperture, element, "glazing", "catalog_row_missing", record_id, [])
    deltas = compare_glazing_ref(glazing, row)
    if not deltas:
        return None
    return _entry(aperture, element, "glazing", "field_delta", record_id, deltas)


def _entry(
    aperture: ApertureTypeEntry,
    element: ApertureElement,
    target: DriftTarget,
    kind: DriftKind,
    record_id: str,
    deltas: list[RefFieldDelta],
) -> ApertureDriftEntry:
    return ApertureDriftEntry(
        aperture_type_id=aperture.id,
        aperture_type_name=aperture.name,
        element_id=element.id,
        element_name=element.name,
        target=target,
        kind=kind,
        catalog_record_id=record_id,
        deltas=deltas,
    )


def _frame_target(side: str) -> DriftTarget:
    # Narrow the runtime side string into the DriftTarget literal so
    # callers and the response model stay in sync.
    if side == "top":
        return "frame.top"
    if side == "right":
        return "frame.right"
    if side == "bottom":
        return "frame.bottom"
    if side == "left":
        return "frame.left"
    raise ValueError(f"Unknown side: {side}")
