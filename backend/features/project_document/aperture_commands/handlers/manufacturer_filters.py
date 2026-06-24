"""``setManufacturerFilters`` handler.

Replaces ``tables.manufacturer_filters`` with the payload's enabled
lists. A ``None`` list means "all manufacturers enabled" — the
explicit default. The handler refuses any new list that drops a
manufacturer currently referenced by an element so a stale filter
cannot strand the user's existing picks.
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import build_audit
from features.project_document.aperture_commands.models import SetManufacturerFilters
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.apertures.lookup import frame_by_id, glazing_by_id
from features.project_document.document import (
    ManufacturerFilters,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def apply_set_manufacturer_filters(
    body: ProjectDocumentV1,
    command: SetManufacturerFilters,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    in_use_frames, in_use_glazings = _collect_in_use(body)

    _check_in_use(
        proposed=command.frame_manufacturers_enabled,
        in_use=in_use_frames,
        error_code="manufacturer_filter_strands_frame_picks",
        message="Cannot disable frame manufacturer(s) currently picked on an element.",
    )
    _check_in_use(
        proposed=command.glazing_manufacturers_enabled,
        in_use=in_use_glazings,
        error_code="manufacturer_filter_strands_glazing_picks",
        message="Cannot disable glazing manufacturer(s) currently picked on an element.",
    )

    filters = ManufacturerFilters(
        frame_manufacturers_enabled=_canonical_list(command.frame_manufacturers_enabled),
        glazing_manufacturers_enabled=_canonical_list(command.glazing_manufacturers_enabled),
    )
    next_tables = body.tables.model_copy(update={"manufacturer_filters": filters})
    next_body = body.model_copy(update={"tables": next_tables})
    return next_body, build_audit(
        "setManufacturerFilters",
        actor_user_id,
        frame_manufacturers_enabled=filters.frame_manufacturers_enabled,
        glazing_manufacturers_enabled=filters.glazing_manufacturers_enabled,
        affects_u_value=False,
    )


def _check_in_use(
    *,
    proposed: list[str] | None,
    in_use: set[str],
    error_code: str,
    message: str,
) -> None:
    if proposed is None:
        return
    proposed_set = {m.casefold() for m in proposed}
    stranded = sorted({m for m in in_use if m.casefold() not in proposed_set})
    if stranded:
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, error_code, message, {"in_use": stranded})


def _canonical_list(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    seen: dict[str, str] = {}
    for raw in value:
        cleaned = raw.strip()
        if not cleaned:
            continue
        seen.setdefault(cleaned.casefold(), cleaned)
    return sorted(seen.values(), key=str.casefold)


def _collect_in_use(body: ProjectDocumentV1) -> tuple[set[str], set[str]]:
    frames: set[str] = set()
    glazings: set[str] = set()
    for aperture in body.tables.apertures:
        for element in aperture.elements:
            for side in ("top", "right", "bottom", "left"):
                frame = frame_by_id(body.tables, getattr(element.frames, side))
                if frame is not None and frame.manufacturer:
                    frames.add(frame.manufacturer.strip())
            glazing = glazing_by_id(body.tables, element.glazing_id)
            if glazing is not None and glazing.manufacturer:
                glazings.add(glazing.manufacturer.strip())
    return frames, glazings
