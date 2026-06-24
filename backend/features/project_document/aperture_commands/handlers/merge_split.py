"""Merge / split handlers — Phase 08 element-level structural edits.

``mergeElements`` validates that the selected element ids form a
contiguous rectangle inside the aperture grid; the merged element
inherits its 6 assignment fields (operation, glazing, four frames)
*and* its ``name`` from the top-left source (sorted by row_span[0]
then column_span[0]). The other sources are dropped.

``splitElement`` explodes a multi-cell element into one fresh 1×1
element per covered cell. Every new element inherits the source's
assignments and name; catalog-origin ``synced_at`` is re-stamped so
Phase 12 drift detection treats the copies as distinct picks.

Both handlers re-run the document validator at the dispatcher seam,
which enforces the coverage invariant — but we also validate
locally so the structured error code is meaningful.
"""

from __future__ import annotations

import uuid

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_element,
    find_entry,
    replace_aperture,
)
from features.project_document.aperture_commands.models import (
    MergeElements,
    SplitElement,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def apply_merge_elements(
    body: ProjectDocumentV1,
    command: MergeElements,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    sources = _resolve_sources(entry, command.element_ids)
    union = _validate_rectangle(sources, command.element_ids)
    top_left = _top_left(sources)

    merged = ApertureElement(
        id=f"aptel_{uuid.uuid4().hex[:12]}",
        name=top_left.name,
        row_span=union["row_span"],
        column_span=union["column_span"],
        frames=top_left.frames.model_copy(deep=True),
        glazing_id=top_left.glazing_id,
        operation=top_left.operation.model_copy(deep=True) if top_left.operation else None,
    )

    source_ids = {el.id for el in sources}
    survivors = [el for el in entry.elements if el.id not in source_ids]
    survivors.append(merged)
    next_entry = entry.model_copy(update={"elements": survivors})
    next_body = replace_aperture(body, aperture_idx, next_entry)

    return next_body, build_audit(
        "mergeElements",
        actor_user_id,
        aperture_type_id=entry.id,
        merged_element_id=merged.id,
        source_element_ids=list(command.element_ids),
        top_left_source_id=top_left.id,
        affects_u_value=True,
    )


def apply_split_element(
    body: ProjectDocumentV1,
    command: SplitElement,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, entry = find_entry(body, command.aperture_type_id)
    source_idx, source = find_element(entry, command.element_id)

    rs, re = source.row_span
    cs, ce = source.column_span
    if rs == re and cs == ce:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_split_not_splittable",
            "Element is already 1×1; nothing to split.",
            {"element_id": command.element_id},
        )

    new_elements: list[ApertureElement] = []
    for r in range(rs, re + 1):
        for c in range(cs, ce + 1):
            new_elements.append(
                ApertureElement(
                    id=f"aptel_{uuid.uuid4().hex[:12]}",
                    name=source.name,
                    row_span=(r, r),
                    column_span=(c, c),
                    frames=source.frames.model_copy(deep=True),
                    glazing_id=source.glazing_id,
                    operation=source.operation.model_copy(deep=True) if source.operation else None,
                )
            )

    survivors = list(entry.elements)
    survivors.pop(source_idx)
    survivors.extend(new_elements)
    next_entry = entry.model_copy(update={"elements": survivors})
    next_body = replace_aperture(body, aperture_idx, next_entry)

    return next_body, build_audit(
        "splitElement",
        actor_user_id,
        aperture_type_id=entry.id,
        source_element_id=source.id,
        new_element_ids=[el.id for el in new_elements],
        affects_u_value=True,
    )


# ---- Validation helpers ---------------------------------------------------


def _resolve_sources(entry: ApertureTypeEntry, ids: list[str]) -> list[ApertureElement]:
    by_id = {el.id: el for el in entry.elements}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_element_not_found",
            "One or more merge source elements were not found.",
            {"aperture_type_id": entry.id, "missing_ids": missing},
        )
    if len(set(ids)) != len(ids):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_merge_duplicate_ids",
            "Merge source list contains duplicate element ids.",
            {"element_ids": ids},
        )
    return [by_id[i] for i in ids]


def _validate_rectangle(
    sources: list[ApertureElement],
    ids: list[str],
) -> dict[str, tuple[int, int]]:
    r0 = min(el.row_span[0] for el in sources)
    r1 = max(el.row_span[1] for el in sources)
    c0 = min(el.column_span[0] for el in sources)
    c1 = max(el.column_span[1] for el in sources)

    covered: set[tuple[int, int]] = set()
    for el in sources:
        for r in range(el.row_span[0], el.row_span[1] + 1):
            for c in range(el.column_span[0], el.column_span[1] + 1):
                if (r, c) in covered:
                    raise api_error(
                        status.HTTP_422_UNPROCESSABLE_CONTENT,
                        "aperture_merge_not_rectangle",
                        "Merge sources overlap on the same cell.",
                        {"element_ids": ids, "cell": [r, c]},
                    )
                covered.add((r, c))
    expected = (r1 - r0 + 1) * (c1 - c0 + 1)
    if len(covered) != expected:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_merge_not_rectangle",
            "Selection isn't a rectangle. Pick contiguous cells to merge.",
            {"element_ids": ids},
        )
    return {"row_span": (r0, r1), "column_span": (c0, c1)}


def _top_left(sources: list[ApertureElement]) -> ApertureElement:
    return min(sources, key=lambda el: (el.row_span[0], el.column_span[0]))


__all__ = ["apply_merge_elements", "apply_split_element"]
