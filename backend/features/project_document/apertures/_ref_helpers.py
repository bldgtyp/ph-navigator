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

from datetime import datetime

from features.project_document.document import (
    CatalogOrigin,
    FrameRef,
    GlazingRef,
)


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
