"""Refresh-from-catalog drift detection for window-types refs.

Walks every `FrameRef` / `GlazingRef` carried inside a project version's
`tables.window_types[]`, batch-loads the referenced catalog rows (active +
soft-deleted), and reports per-slot drift state plus per-field deltas.
This is read-only: applying refreshes happens through the existing
project-document replace-slice path.

Hand-entered refs (`catalog_origin = None`) are skipped entirely — they
have no source row to drift from.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal
from uuid import UUID

from psycopg import Connection
from pydantic import BaseModel, ConfigDict

from database import connection
from features.catalogs.frame_types.repository import get_frame_type
from features.catalogs.glazing_types.repository import get_glazing_type
from features.project_document.document import (
    CatalogTableName,
    FrameRef,
    GlazingRef,
    ProjectDocumentV1,
    WindowElement,
    WindowTypeEntry,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import (
    get_current_document_view,
    get_saved_document,
)
from features.project_document.validation import document_etag
from features.projects.access import ProjectAccess

# Field sets to compare per catalog. Mirror the typed catalog row shape so a
# drift report does not silently miss new fields when the catalog grows; if a
# catalog field is added, this list must grow with it.
FRAME_REF_COMPARED_FIELDS: tuple[str, ...] = (
    "name",
    "manufacturer",
    "brand",
    "width_mm",
    "u_value_w_m2k",
    "psi_g_w_mk",
    "psi_install_w_mk",
    "color",
    "notes",
    "source_provenance",
)
GLAZING_REF_COMPARED_FIELDS: tuple[str, ...] = (
    "name",
    "manufacturer",
    "brand",
    "u_value_w_m2k",
    "g_value",
    "color",
    "notes",
    "source_provenance",
)

SlotName = Literal[
    "frame.top",
    "frame.right",
    "frame.bottom",
    "frame.left",
    "glazing",
]
SlotState = Literal["in_sync", "drifted", "source_deactivated"]
RefreshSkipReason = Literal["field_type_changed"]

_FRAME_SLOTS: tuple[tuple[SlotName, str], ...] = (
    ("frame.top", "top"),
    ("frame.right", "right"),
    ("frame.bottom", "bottom"),
    ("frame.left", "left"),
)

_COMPARED_FIELDS_BY_CATALOG: dict[CatalogTableName, tuple[str, ...]] = {
    "frame_types": FRAME_REF_COMPARED_FIELDS,
    "glazing_types": GLAZING_REF_COMPARED_FIELDS,
}

_CATALOG_GETTERS: dict[CatalogTableName, Callable[[Connection[Any], str], dict[str, Any] | None]] = {
    "frame_types": get_frame_type,
    "glazing_types": get_glazing_type,
}


class RefreshFieldDelta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    ref_value: Any
    catalog_value: Any
    is_overridden: bool
    skip_reason: RefreshSkipReason | None = None


class RefreshSlotReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_type_id: str
    element_id: str
    slot: SlotName
    state: SlotState
    catalog_table: CatalogTableName
    catalog_record_id: str
    pinned_catalog_version_id: str
    current_catalog_version_id: str | None
    local_overrides: list[str]
    fields: list[RefreshFieldDelta]


class WindowTypesRefreshReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    slots: list[RefreshSlotReport]


def get_window_types_refresh_report(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> WindowTypesRefreshReport:
    """Build the per-slot drift report for the requested source view.

    `source="version"` reads the saved version body, ignoring any draft.
    `source="draft"` reads the current document view (draft if present,
    otherwise the saved version).
    """
    if source == "version":
        body = get_saved_document(version_id, access)
        version_etag = document_etag(body)
        report_source: ProjectDocumentSource = "version"
        draft_etag: str | None = None
    else:
        view = get_current_document_view(version_id, access)
        body = view.body
        version_etag = view.version_etag
        report_source = view.source
        draft_etag = view.draft_etag

    refs = list(_iter_catalog_refs(body))
    catalog_rows = _load_catalog_rows(refs)
    slots = [_slot_report(ref, catalog_rows) for ref in refs]
    return WindowTypesRefreshReport(
        project_id=access.project_id,
        version_id=version_id,
        source=report_source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        slots=slots,
    )


# ---------------------------------------------------------------- internals

_RefEntry = tuple[WindowTypeEntry, WindowElement, SlotName, FrameRef | GlazingRef]


def _iter_catalog_refs(body: ProjectDocumentV1) -> list[_RefEntry]:
    """Walk window types/elements and yield only refs with a catalog_origin.

    Hand-entered refs (catalog_origin=None) are excluded — no drift to report.
    """
    out: list[_RefEntry] = []
    for window_type in body.tables.window_types:
        for element in window_type.elements:
            for slot_name, attr in _FRAME_SLOTS:
                ref: FrameRef | None = getattr(element.frames, attr)
                if ref is not None and ref.catalog_origin is not None:
                    out.append((window_type, element, slot_name, ref))
            glazing = element.glazing
            if glazing is not None and glazing.catalog_origin is not None:
                out.append((window_type, element, "glazing", glazing))
    return out


def _load_catalog_rows(refs: list[_RefEntry]) -> dict[tuple[CatalogTableName, str], dict[str, Any] | None]:
    """Load each unique (catalog_table, catalog_record_id) once.

    Soft-deleted rows are returned by the existing repository getters because
    `_SELECT_JOINED` does not filter on `deleted_at`. Missing rows resolve to
    None and surface as `source_deactivated` downstream. One repository call
    per unique id — fine at v1 scale; pivot to `WHERE id = ANY(...)` if real
    projects routinely carry >100 unique refs.
    """
    needed: set[tuple[CatalogTableName, str]] = set()
    for _, _, _, ref in refs:
        origin = ref.catalog_origin
        if origin is None:
            # _iter_catalog_refs only yields refs whose catalog_origin is set;
            # reaching here means that invariant was broken upstream.
            raise RuntimeError("Expected catalog_origin on ref from _iter_catalog_refs")
        needed.add((origin.catalog_table, origin.catalog_record_id))

    rows: dict[tuple[CatalogTableName, str], dict[str, Any] | None] = {}
    if not needed:
        return rows
    with connection() as conn:
        for table, record_id in needed:
            getter = _CATALOG_GETTERS.get(table)
            rows[(table, record_id)] = getter(conn, record_id) if getter else None
    return rows


def _slot_report(
    entry: _RefEntry,
    catalog_rows: dict[tuple[CatalogTableName, str], dict[str, Any] | None],
) -> RefreshSlotReport:
    window_type, element, slot, ref = entry
    origin = ref.catalog_origin
    if origin is None:
        raise RuntimeError("Expected catalog_origin on ref from _iter_catalog_refs")
    row = catalog_rows.get((origin.catalog_table, origin.catalog_record_id))
    is_deactivated = row is None or not row.get("is_active", False)

    compared_fields = _COMPARED_FIELDS_BY_CATALOG.get(origin.catalog_table, ())
    ref_dump = ref.model_dump(mode="json")
    overrides = set(origin.local_overrides)
    fields = [
        RefreshFieldDelta(
            key=key,
            ref_value=ref_dump.get(key),
            catalog_value=None if is_deactivated else (row or {}).get(key),
            is_overridden=key in overrides,
        )
        for key in compared_fields
    ]

    if is_deactivated:
        state: SlotState = "source_deactivated"
        current_version_id: str | None = None
    else:
        assert row is not None
        current_version_id = row.get("current_version_id")
        drifted_version = current_version_id != origin.catalog_version_id
        drifted_fields = any(field.ref_value != field.catalog_value for field in fields)
        state = "drifted" if (drifted_version or drifted_fields) else "in_sync"

    return RefreshSlotReport(
        window_type_id=window_type.id,
        element_id=element.id,
        slot=slot,
        state=state,
        catalog_table=origin.catalog_table,
        catalog_record_id=origin.catalog_record_id,
        pinned_catalog_version_id=origin.catalog_version_id,
        current_catalog_version_id=current_version_id,
        local_overrides=list(origin.local_overrides),
        fields=fields,
    )
