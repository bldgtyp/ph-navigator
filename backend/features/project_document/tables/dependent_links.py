"""Generic cross-table delete cascade for registered document tables.

A registered table can declare ``dependent_links``: sibling tables that
point back at it. When a slice-replace removes rows from this table, the
shared helpers here either

- **block** the delete (HTTP 409) when a *required* dependent link would be
  left dangling — the dependent row cannot drop the reference, so the delete
  is refused; or
- **clear** the reference when the dependent link is *optional* — the scalar
  link is set to ``None`` and list links are filtered.

This replaces the bespoke heat-pump cascade (``_apply_delete_cascades`` /
``_delete_preview``). The same analysis backs the dry-run preview, so the
"what would this delete touch" question and the actual mutation never drift.

``DependentLink`` (the per-contract config) lives in ``contracts.py`` since it
is a ``TableContract`` field; the cascade logic here imports it back.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from starlette import status

from features.project_document.document import ProjectDocumentV1
from features.project_document.tables.contracts import (
    DependentLink,
    read_table_envelope,
    replace_table_envelope,
)
from features.shared.errors import api_error

# Generic delete-block error code: any table with a required dependent link
# raises it when a delete would orphan that link. The frontend keys the
# blocked-delete dialog off the HTTP 409 status + details payload, not this
# string (so the value is backend-only).
DEPENDENT_LINK_DELETE_BLOCKED = "dependent_link_delete_blocked"

__all__ = [
    "DEPENDENT_LINK_DELETE_BLOCKED",
    "DependentLink",
    "DependentRef",
    "apply_dependent_link_cascade",
    "preview_dependent_link_cascade",
]


@dataclass(frozen=True)
class DependentRef:
    """One dependent row affected by (or blocking) a delete."""

    table: str
    row_id: str
    tag: str
    field: str

    def as_dict(self) -> dict[str, str]:
        return {"table": self.table, "row_id": self.row_id, "tag": self.tag, "field": self.field}


def _table_rows(body: ProjectDocumentV1, table_path: tuple[str, ...]) -> list[Any]:
    return list(cast(Any, read_table_envelope(body, table_path)).rows)


def _set_table_rows(body: ProjectDocumentV1, table_path: tuple[str, ...], rows: list[Any]) -> ProjectDocumentV1:
    envelope = cast(Any, read_table_envelope(body, table_path)).model_copy(update={"rows": rows})
    return replace_table_envelope(body, table_path, envelope)


def _removed_row_ids(
    base_body: ProjectDocumentV1, next_body: ProjectDocumentV1, table_path: tuple[str, ...]
) -> set[str]:
    before = {row.id for row in _table_rows(base_body, table_path)}
    after = {row.id for row in _table_rows(next_body, table_path)}
    return before - after


def _row_references(row: Any, field_key: str, removed: set[str]) -> bool:
    value = getattr(row, field_key)
    if isinstance(value, list):
        return any(item in removed for item in value)
    return value in removed


def _collect_refs(
    body: ProjectDocumentV1, removed: set[str], links: tuple[DependentLink, ...], *, required: bool
) -> list[DependentRef]:
    refs: list[DependentRef] = []
    for link in links:
        if link.required is not required:
            continue
        for row in _table_rows(body, link.dependent_table_path):
            if _row_references(row, link.field_key, removed):
                refs.append(
                    DependentRef(
                        table=link.dependent_table_label,
                        row_id=row.id,
                        tag=str(getattr(row, "tag", row.id)),
                        field=link.field_key,
                    )
                )
    return refs


def _raise_blocked(blocked: list[DependentRef]) -> None:
    raise api_error(
        status.HTTP_409_CONFLICT,
        DEPENDENT_LINK_DELETE_BLOCKED,
        "This record is referenced by dependent records and cannot be deleted.",
        {"referenced_by": [ref.as_dict() for ref in blocked]},
    )


def preview_dependent_link_cascade(
    base_body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    removed: set[str],
    dependent_links: tuple[DependentLink, ...],
) -> list[DependentRef]:
    """Return the optional links that *would* be cleared by deleting ``removed``.

    Pure (no mutation). Raises 409 when a required dependent link would be left
    dangling, exactly as the persisting path does — so a dry-run and the real
    delete agree on whether the operation is allowed.
    """
    if not removed:
        return []
    blocked = _collect_refs(base_body, removed, dependent_links, required=True)
    if blocked:
        _raise_blocked(blocked)
    return _collect_refs(base_body, removed, dependent_links, required=False)


def apply_dependent_link_cascade(
    base_body: ProjectDocumentV1,
    next_body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    dependent_links: tuple[DependentLink, ...],
) -> ProjectDocumentV1:
    """Block or clear dependent references for rows removed in ``next_body``.

    ``next_body`` already has this table's rows replaced; siblings are still as
    in ``base_body``. Returns ``next_body`` with optional dependent links
    cleared, or raises 409 if a required link blocks the delete.
    """
    removed = _removed_row_ids(base_body, next_body, table_path)
    if not removed:
        return next_body
    blocked = _collect_refs(next_body, removed, dependent_links, required=True)
    if blocked:
        _raise_blocked(blocked)

    result = next_body
    for link in dependent_links:
        if link.required:
            continue
        rows = _table_rows(result, link.dependent_table_path)
        cleared = [_clear_link(row, link.field_key, removed) for row in rows]
        if cleared != rows:
            result = _set_table_rows(result, link.dependent_table_path, cleared)
    return result


def _clear_link(row: Any, field_key: str, removed: set[str]) -> Any:
    value = getattr(row, field_key)
    if isinstance(value, list):
        kept: list[Any] = []
        for item in value:
            if item not in removed and item not in kept:
                kept.append(item)
        return row.model_copy(update={field_key: kept}) if kept != value else row
    if value in removed:
        return row.model_copy(update={field_key: None})
    return row
