"""Catalog-origin helpers shared by the aperture factory and command handlers.

Two semantically different ``catalog_origin`` advance variants live here
because the original 13-phase build duplicated them under one name
(``_refresh_origin``) and the difference is load-bearing:

- :func:`reset_origin` discards ``local_overrides`` and pins
  ``catalog_schema_version`` to ``1``. Used by paths that create a fresh
  ref slot (factory build, bookshelf copy from catalog, picker apply).
- :func:`advance_origin` preserves ``local_overrides`` and the prior
  ``catalog_schema_version``. Used by structural-only paths (split,
  duplicate) where the user's prior overrides should survive the
  rearrangement.

``bookshelf_copy_frame`` / ``bookshelf_copy_glazing`` are the canonical
"new ref from catalog row" copies; both go through :func:`reset_origin`.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Protocol, cast

from features.project_document.envelope_models import (
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectFrame,
    ProjectGlazing,
)


class TablesWithApertureRefs(Protocol):
    project_glazings: list[ProjectGlazing]
    project_frames: list[ProjectFrame]


def reset_origin(origin: CatalogOrigin | None, *, synced_at: datetime) -> CatalogOrigin | None:
    """Refresh the origin for a freshly-picked ref.

    Resets ``local_overrides`` to ``[]`` because the consumer is filling
    a fresh ref slot — any prior overrides do not belong to the new
    occupant. Pins ``catalog_schema_version`` to ``1`` (Phase 01 hook).
    """

    if origin is None:
        return None
    return origin.model_copy(
        update={"catalog_schema_version": 1, "synced_at": synced_at, "local_overrides": []},
    )


def advance_origin(origin: CatalogOrigin | None, *, synced_at: datetime) -> CatalogOrigin | None:
    """Advance the origin for a structural copy (split, duplicate).

    Preserves ``local_overrides`` from the source — the user explicitly
    overrode catalog values on the original ref, and a structural split
    or duplicate should not silently revert those edits. Falls back to
    ``catalog_schema_version=1`` only when the source did not carry one.
    """

    if origin is None:
        return None
    return origin.model_copy(
        update={
            "synced_at": synced_at,
            "catalog_schema_version": origin.catalog_schema_version or 1,
        },
    )


def bookshelf_copy_frame(frame: FrameRef, *, synced_at: datetime) -> FrameRef:
    """Deep-copy ``frame`` into a fresh ref slot with a reset origin."""

    return frame.model_copy(
        update={"catalog_origin": reset_origin(frame.catalog_origin, synced_at=synced_at)},
        deep=True,
    )


def bookshelf_copy_glazing(glazing: GlazingRef | None, *, synced_at: datetime) -> GlazingRef | None:
    """Deep-copy ``glazing`` into a fresh ref slot with a reset origin.

    Passes ``None`` through so callers can use the same call-site for
    optional glazing targets.
    """

    if glazing is None:
        return None
    return glazing.model_copy(
        update={"catalog_origin": reset_origin(glazing.catalog_origin, synced_at=synced_at)},
        deep=True,
    )


def ensure_project_glazing(tables: TablesWithApertureRefs, ref: GlazingRef) -> str:
    """Upsert a picked glazing ref into the flat project glazing table."""

    existing_id = _find_existing_catalog_entity_id(tables.project_glazings, ref.catalog_origin)
    if existing_id is not None:
        return existing_id
    glazing = project_glazing_from_ref(ref, id=f"pglz_{_short_uuid()}")
    tables.project_glazings.append(glazing)
    return glazing.id


def ensure_project_frame(tables: TablesWithApertureRefs, ref: FrameRef) -> str:
    """Upsert a picked frame ref into the flat project frame table."""

    existing_id = _find_existing_catalog_entity_id(tables.project_frames, ref.catalog_origin)
    if existing_id is not None:
        return existing_id
    frame = project_frame_from_ref(ref, id=f"pfrm_{_short_uuid()}")
    tables.project_frames.append(frame)
    return frame.id


def ensure_raw_project_glazing(tables: dict[str, Any], ref: GlazingRef) -> str:
    """Raw-dict variant used before Pydantic validates a legacy document."""

    rows = cast(list[dict[str, Any]], tables.setdefault("project_glazings", []))
    existing_id = _find_existing_raw_catalog_entity_id(rows, ref.catalog_origin)
    if existing_id is not None:
        return existing_id
    glazing = project_glazing_from_ref(ref, id=f"pglz_{_short_uuid()}")
    rows.append(glazing.model_dump(mode="json"))
    return glazing.id


def ensure_raw_project_frame(tables: dict[str, Any], ref: FrameRef) -> str:
    """Raw-dict variant used before Pydantic validates a legacy document."""

    rows = cast(list[dict[str, Any]], tables.setdefault("project_frames", []))
    existing_id = _find_existing_raw_catalog_entity_id(rows, ref.catalog_origin)
    if existing_id is not None:
        return existing_id
    frame = project_frame_from_ref(ref, id=f"pfrm_{_short_uuid()}")
    rows.append(frame.model_dump(mode="json"))
    return frame.id


def project_glazing_from_ref(ref: GlazingRef, *, id: str) -> ProjectGlazing:
    payload = ref.model_dump(mode="python", exclude={"datasheet_url"})
    return ProjectGlazing(
        **payload,
        id=id,
        specification_status="missing",
        datasheet_asset_ids=[],
    )


def project_frame_from_ref(ref: FrameRef, *, id: str) -> ProjectFrame:
    payload = ref.model_dump(mode="python", exclude={"datasheet_url"})
    return ProjectFrame(
        **payload,
        id=id,
        specification_status="missing",
        datasheet_asset_ids=[],
    )


def _find_existing_catalog_entity_id(
    rows: list[ProjectGlazing] | list[ProjectFrame],
    origin: CatalogOrigin | None,
) -> str | None:
    if origin is None:
        return None
    for row in rows:
        row_origin = row.catalog_origin
        if row_origin is None:
            continue
        if (
            row_origin.catalog_table == origin.catalog_table
            and row_origin.catalog_record_id == origin.catalog_record_id
        ):
            return row.id
    return None


def _find_existing_raw_catalog_entity_id(
    rows: list[dict[str, Any]],
    origin: CatalogOrigin | None,
) -> str | None:
    if origin is None:
        return None
    for row in rows:
        row_origin = row.get("catalog_origin")
        if not isinstance(row_origin, dict):
            continue
        if (
            row_origin.get("catalog_table") == origin.catalog_table
            and row_origin.get("catalog_record_id") == origin.catalog_record_id
        ):
            row_id = row.get("id")
            return row_id if isinstance(row_id, str) else None
    return None


def _short_uuid() -> str:
    return uuid.uuid4().hex[:12]
