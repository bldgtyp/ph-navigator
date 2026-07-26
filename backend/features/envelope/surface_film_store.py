"""Object-store home for licensed surface-film tables (ASHRAE).

**This module is the loader. It must never contain the values.** ASHRAE
Fundamentals is licensed and this repo is public, so the ASHRAE surface
resistances live in the private object store — MinIO locally, Cloudflare R2
in deployment — exactly as the licensed climate bundles do
(``features.climate.object_store``, ``context/DATA_STORAGE.md`` class ④).

ISO 6946 is different and stays in code (``boundary_conditions.ISO_6946_TABLE``):
it is the default, it is already published in this feature's PRD, and keeping
it in-repo means a deployment with no private store still computes U-values.

Key layout::

    standards/<standard>/surface_films.json

Payload (SI, m²·K/W)::

    {
      "standard": "ashrae",
      "rsi_by_direction": {"upward": …, "horizontal": …, "downward": …},
      "rse_outdoor_air_m2k_w": …,
      "source": "<citation the operator supplies>"
    }

Seed it with ``python -m scripts.seed_surface_films`` (see that module for
how the operator points it at their own copy of the handbook tables).
"""

from __future__ import annotations

import json
from typing import Any, Protocol, cast

from botocore.exceptions import ClientError

from config import settings
from features.assets.storage_r2 import R2Client
from features.envelope.boundary_conditions import (
    ISO_6946_TABLE,
    HeatFlowDirection,
    SurfaceFilmTable,
)
from features.project_document.document import ThermalStandard

_CONTENT_TYPE = "application/json"
_DIRECTIONS: tuple[HeatFlowDirection, ...] = ("upward", "horizontal", "downward")


class SurfaceFilmTableUnavailableError(RuntimeError):
    """A standard was requested whose table is not published to the store."""


def surface_film_object_key(standard: ThermalStandard) -> str:
    """Object key for one standard's published surface-film table."""
    return f"standards/{standard}/surface_films.json"


class SurfaceFilmObjectStore(Protocol):
    """The two operations this store needs.

    Narrower than ``AssetStorage`` on purpose: publishing and reading one
    small JSON needs no presigning, thumbnails, or copy/delete, and the
    narrow surface is what a test fake can honestly satisfy. ``R2Client``
    matches structurally.
    """

    def get_object(self, object_key: str) -> bytes: ...

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str: ...


class SurfaceFilmStore:
    """Read/write licensed surface-film tables in the object store."""

    def __init__(self, storage: SurfaceFilmObjectStore) -> None:
        self._storage = storage

    @classmethod
    def from_settings(cls) -> SurfaceFilmStore:
        """Build the store over the configured R2/MinIO client.

        Callers confirm ``settings.r2_endpoint_url`` first and raise their
        own context-specific message when it is unset (matching
        ``ClimateBundleStore``).
        """
        return cls(R2Client(settings))

    def put(self, table: SurfaceFilmTable, *, source: str) -> str:
        """Publish one table. ``source`` is the operator's own citation."""
        key = surface_film_object_key(table.standard)
        payload = {
            "standard": table.standard,
            "rsi_by_direction": dict(table.rsi_by_direction),
            "rse_outdoor_air_m2k_w": table.rse_outdoor_air_m2k_w,
            "source": source,
        }
        self._storage.put_object(
            object_key=key,
            body=json.dumps(payload, indent=2, sort_keys=True).encode(),
            content_type=_CONTENT_TYPE,
        )
        return key

    def get(self, standard: ThermalStandard) -> SurfaceFilmTable | None:
        """Return the published table, or ``None`` when nothing is published."""
        try:
            raw = self._storage.get_object(surface_film_object_key(standard))
        except ClientError:
            return None
        return parse_surface_film_payload(json.loads(raw), standard)


def parse_surface_film_payload(payload: object, standard: ThermalStandard) -> SurfaceFilmTable:
    if not isinstance(payload, dict):
        raise SurfaceFilmTableUnavailableError(f"{standard} surface-film payload must be a JSON object")
    body = cast(dict[str, Any], payload)
    raw_rsi = body.get("rsi_by_direction")
    if not isinstance(raw_rsi, dict):
        raise SurfaceFilmTableUnavailableError(f"{standard} surface-film payload needs 'rsi_by_direction'")
    rsi_by_direction: dict[HeatFlowDirection, float] = {}
    for direction in _DIRECTIONS:
        value = cast(dict[str, Any], raw_rsi).get(direction)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            raise SurfaceFilmTableUnavailableError(
                f"{standard} surface-film payload needs a positive '{direction}' Rsi"
            )
        rsi_by_direction[direction] = float(value)
    rse = body.get("rse_outdoor_air_m2k_w")
    if not isinstance(rse, (int, float)) or isinstance(rse, bool) or rse < 0:
        raise SurfaceFilmTableUnavailableError(f"{standard} surface-film payload needs 'rse_outdoor_air_m2k_w'")
    return SurfaceFilmTable(
        standard=standard,
        rsi_by_direction=rsi_by_direction,
        rse_outdoor_air_m2k_w=float(rse),
    )


#: Process-level cache. The tables are app-wide, tiny, and immutable once
#: published, so one fetch per process is enough — and it keeps the object
#: store off the per-request thermal path.
_cache: dict[ThermalStandard, SurfaceFilmTable] = {}


def surface_film_table(standard: ThermalStandard) -> SurfaceFilmTable:
    """Return the table in force for ``standard``.

    ISO 6946 resolves from code and never touches the store. Anything else
    is licensed, so it is fetched once and cached; a standard with nothing
    published raises rather than silently falling back to ISO values, which
    would report one convention under another's name.
    """
    if standard == "iso_6946":
        return ISO_6946_TABLE
    cached = _cache.get(standard)
    if cached is not None:
        return cached
    if not settings.r2_endpoint_url:
        raise SurfaceFilmTableUnavailableError(
            f"the {standard} surface-film table is licensed and lives in the object store, "
            "which is not configured for this deployment"
        )
    table = SurfaceFilmStore.from_settings().get(standard)
    if table is None:
        raise SurfaceFilmTableUnavailableError(
            f"no {standard} surface-film table is published; seed it with scripts.seed_surface_films"
        )
    _cache[standard] = table
    return table


def reset_surface_film_cache() -> None:
    """Drop the process cache (tests, and after a re-seed)."""
    _cache.clear()
