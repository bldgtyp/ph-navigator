"""Dimension-strip handlers: editDimension, addRow / addColumn, deleteRow / deleteColumn.

Phase 05 fills in the five command stubs that Phase 01 reserved in the
union but raised ``aperture_command_not_implemented`` for. All five run
pure structural mutations over ``row_heights_mm`` / ``column_widths_mm``
and the element ``row_span`` / ``column_span`` tuples; coverage is
re-validated implicitly by the final ``ApertureTypeEntry`` rebuild via
the model validator.

The two axes (row / column) share an identical algorithm — the public
handlers ``apply_add_row`` etc. are thin wrappers that swap the axis
labels and delegate into ``_add_along_axis`` / ``_delete_along_axis``.
This keeps the row/column rules in one place so future maintenance can
fix both axes at once.

Notes on the add / delete rules:

- **Add at index *i*:** elements with ``span_start >= i`` shift outward
  by ``+1``; elements that straddle the insertion line
  (``span_start < i <= span_end``) extend their ``span_end`` by ``+1``
  so the new line passes through them transparently. For columns of the
  inserted row that are *not* already covered by a straddling element,
  one new default-frame / default-glazing element is created (via the
  Phase 01 factory's catalog reader).

- **Delete at index *i*:** elements whose entire span ``== [i, i]``
  become orphans and are dropped; elements that straddle shrink their
  ``span_end`` by ``-1``; elements past the deletion shift inward by
  ``-1``. The "shift on every other element" naturally re-covers the
  orphan's cells with the next row / column's elements — no explicit
  "absorbed by neighbor" reassignment is needed once the spans clamp,
  because the deletion + shift collapses the orphan's row/column out
  of existence and the adjacent elements move into its place. The
  phase doc's "absorbed by highest-index neighbor on same axis" rule
  is therefore satisfied by construction; we record that explicitly
  here so the Phase 08 split-undo path can reference the same
  ordering.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_entry,
    replace_aperture,
)
from features.project_document.aperture_commands.models import (
    AddColumn,
    AddRow,
    DeleteColumn,
    DeleteRow,
    EditDimension,
)
from features.project_document.apertures._ref_helpers import (
    bookshelf_copy_frame,
    bookshelf_copy_glazing,
    ensure_project_frame,
    ensure_project_glazing,
)
from features.project_document.apertures.factories import (
    DefaultsCatalogReader,
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
    ProjectDocumentV1,
)
from features.shared.errors import api_error

DEFAULT_NEW_DIM_MM = 1000.0


# ---- Public handlers ------------------------------------------------------


def apply_edit_dimension(
    body: ProjectDocumentV1,
    command: EditDimension,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    is_row = command.axis == "row"
    dims = list(entry.row_heights_mm if is_row else entry.column_widths_mm)
    if command.index >= len(dims):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_dimension_index_out_of_bounds",
            "Dimension index is past the end of the aperture grid.",
            {"axis": command.axis, "index": command.index, "size": len(dims)},
        )
    previous_mm = dims[command.index]
    dims[command.index] = command.new_value_mm
    field = "row_heights_mm" if is_row else "column_widths_mm"
    next_entry = entry.model_copy(update={field: dims})
    next_body = replace_aperture(body, aperture_idx, next_entry)
    return next_body, build_audit(
        "editDimension",
        actor_user_id,
        aperture_type_id=entry.id,
        axis=command.axis,
        index=command.index,
        previous_mm=previous_mm,
        new_mm=command.new_value_mm,
        affects_u_value=True,
    )


def apply_add_row(
    body: ProjectDocumentV1,
    command: AddRow,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    next_tables = body.tables.model_copy(deep=True)
    next_entry = _add_along_axis(
        entry,
        axis="row",
        at_index=command.at_index,
        new_dim_mm=command.height_mm,
        catalog=catalog,
        tables=next_tables,
    )
    next_body = replace_aperture(body.model_copy(update={"tables": next_tables}), aperture_idx, next_entry)
    return next_body, build_audit(
        "addRow",
        actor_user_id,
        aperture_type_id=entry.id,
        at_index=command.at_index,
        height_mm=command.height_mm,
        affects_u_value=True,
    )


def apply_add_column(
    body: ProjectDocumentV1,
    command: AddColumn,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    next_tables = body.tables.model_copy(deep=True)
    next_entry = _add_along_axis(
        entry,
        axis="column",
        at_index=command.at_index,
        new_dim_mm=command.width_mm,
        catalog=catalog,
        tables=next_tables,
    )
    next_body = replace_aperture(body.model_copy(update={"tables": next_tables}), aperture_idx, next_entry)
    return next_body, build_audit(
        "addColumn",
        actor_user_id,
        aperture_type_id=entry.id,
        at_index=command.at_index,
        width_mm=command.width_mm,
        affects_u_value=True,
    )


def apply_delete_row(
    body: ProjectDocumentV1,
    command: DeleteRow,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    next_entry = _delete_along_axis(entry, axis="row", at_index=command.index)
    next_body = replace_aperture(body, aperture_idx, next_entry)
    return next_body, build_audit(
        "deleteRow",
        actor_user_id,
        aperture_type_id=entry.id,
        index=command.index,
        affects_u_value=True,
    )


def apply_delete_column(
    body: ProjectDocumentV1,
    command: DeleteColumn,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    next_entry = _delete_along_axis(entry, axis="column", at_index=command.index)
    next_body = replace_aperture(body, aperture_idx, next_entry)
    return next_body, build_audit(
        "deleteColumn",
        actor_user_id,
        aperture_type_id=entry.id,
        index=command.index,
        affects_u_value=True,
    )


# ---- Axis-generic core ----------------------------------------------------


def _add_along_axis(
    entry: ApertureTypeEntry,
    *,
    axis: str,
    at_index: int,
    new_dim_mm: float,
    catalog: DefaultsCatalogReader,
    tables: ProjectDocumentTables,
) -> ApertureTypeEntry:
    is_row = axis == "row"
    dims = list(entry.row_heights_mm if is_row else entry.column_widths_mm)
    if at_index > len(dims):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_dimension_index_out_of_bounds",
            "Insertion index is past the end of the aperture grid.",
            {"axis": axis, "at_index": at_index, "size": len(dims)},
        )
    new_dims = [*dims[:at_index], new_dim_mm, *dims[at_index:]]

    cross_dims = entry.column_widths_mm if is_row else entry.row_heights_mm
    cross_size = len(cross_dims)

    extended_cross_cells: set[int] = set()
    next_elements: list[ApertureElement] = []
    for element in entry.elements:
        span = element.row_span if is_row else element.column_span
        cross = element.column_span if is_row else element.row_span
        rs, re = span
        cs, ce = cross

        if at_index <= rs:
            new_span = (rs + 1, re + 1)
        elif at_index > re:
            new_span = (rs, re)
        else:
            new_span = (rs, re + 1)
            for c in range(cs, ce + 1):
                extended_cross_cells.add(c)

        if is_row:
            next_elements.append(element.model_copy(update={"row_span": new_span}))
        else:
            next_elements.append(element.model_copy(update={"column_span": new_span}))

    # Cells in the inserted row/column not covered by straddling elements get
    # one fresh default-frame / default-glazing element apiece.
    frame, glazing = _read_defaults(catalog)
    synced_at = datetime.now(tz=UTC)
    frame_copy = bookshelf_copy_frame(frame, synced_at=synced_at)
    glazing_copy = bookshelf_copy_glazing(glazing, synced_at=synced_at)
    assert glazing_copy is not None  # glazing came from _read_defaults; non-None guaranteed
    frame_id = ensure_project_frame(tables, frame_copy)
    glazing_id = ensure_project_glazing(tables, glazing_copy)

    for c in range(cross_size):
        if c in extended_cross_cells:
            continue
        new_element = _build_seeded_element(
            row_span=(at_index, at_index) if is_row else (c, c),
            column_span=(c, c) if is_row else (at_index, at_index),
            frame_id=frame_id,
            glazing_id=glazing_id,
        )
        next_elements.append(new_element)

    field = "row_heights_mm" if is_row else "column_widths_mm"
    return entry.model_copy(update={field: new_dims, "elements": next_elements})


def _delete_along_axis(entry: ApertureTypeEntry, *, axis: str, at_index: int) -> ApertureTypeEntry:
    is_row = axis == "row"
    dims = list(entry.row_heights_mm if is_row else entry.column_widths_mm)
    if at_index >= len(dims):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_dimension_index_out_of_bounds",
            "Delete index is past the end of the aperture grid.",
            {"axis": axis, "index": at_index, "size": len(dims)},
        )
    if len(dims) <= 1:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_dimension_min_violation",
            "An aperture type must have at least one row and one column.",
            {"axis": axis, "index": at_index},
        )

    new_dims = [*dims[:at_index], *dims[at_index + 1 :]]

    next_elements: list[ApertureElement] = []
    for element in entry.elements:
        span = element.row_span if is_row else element.column_span
        rs, re = span
        if at_index > re:
            new_span: tuple[int, int] | None = (rs, re)
        elif at_index < rs:
            new_span = (rs - 1, re - 1)
        else:
            # straddles or matches
            if rs == re:
                new_span = None  # orphan; drop it
            else:
                new_span = (rs, re - 1)

        if new_span is None:
            continue
        if is_row:
            next_elements.append(element.model_copy(update={"row_span": new_span}))
        else:
            next_elements.append(element.model_copy(update={"column_span": new_span}))

    if not next_elements:
        # Cannot happen for a valid grid (other axis ≥ 1, surviving span
        # required), but surface a structured error if invariants ever drift.
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_dimension_delete_leaves_empty_grid",
            "Deleting this row / column would leave the aperture with no elements.",
            {"axis": axis, "index": at_index},
        )

    field = "row_heights_mm" if is_row else "column_widths_mm"
    return entry.model_copy(update={field: new_dims, "elements": next_elements})


# ---- Helpers --------------------------------------------------------------


def _read_defaults(catalog: DefaultsCatalogReader) -> tuple[FrameRef, GlazingRef]:
    frame = catalog.get_default_frame()
    if frame is None:
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "aperture_default_refs_missing",
            "Default frame catalog row is not seeded; re-run the catalog seed migration.",
            {"missing_catalog_table": "frame_types", "expected_name": APERTURE_DEFAULT_FRAME_NAME},
        )
    glazing = catalog.get_default_glazing()
    if glazing is None:
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "aperture_default_refs_missing",
            "Default glazing catalog row is not seeded; re-run the catalog seed migration.",
            {
                "missing_catalog_table": "glazing_types",
                "expected_name": APERTURE_DEFAULT_GLAZING_NAME,
            },
        )
    return frame, glazing


def _build_seeded_element(
    *,
    row_span: tuple[int, int],
    column_span: tuple[int, int],
    frame_id: str,
    glazing_id: str,
) -> ApertureElement:
    return ApertureElement(
        id=f"aptel_{uuid.uuid4().hex[:12]}",
        name="Unnamed",
        row_span=row_span,
        column_span=column_span,
        frames=ApertureElementFrames(top=frame_id, right=frame_id, bottom=frame_id, left=frame_id),
        glazing_id=glazing_id,
        operation=None,
    )
