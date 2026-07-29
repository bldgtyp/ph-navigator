"""Declarative registry of licensed datasets PH-Navigator can consume."""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from psycopg import Connection

from features.datasets.models import ApplyReport, DatasetKind

DatasetParser = Callable[[bytes], object]


class DatasetApplier(Protocol):
    """Idempotent target-table writer for one parsed db-seed payload."""

    def __call__(self, conn: Connection[Any], payload: object) -> ApplyReport: ...


@dataclass(frozen=True)
class DatasetSpec:
    """Code-side contract for one published dataset slug."""

    slug: str
    kind: DatasetKind
    parse: DatasetParser
    apply: DatasetApplier | None = None


def _parse_ashrae_surface_films(payload: bytes) -> object:
    from features.envelope.surface_film_store import parse_surface_film_payload

    return parse_surface_film_payload(json.loads(payload), "ashrae")


_REGISTRY: dict[str, DatasetSpec] = {
    "ashrae-surface-films": DatasetSpec(
        slug="ashrae-surface-films",
        kind="runtime_read",
        parse=_parse_ashrae_surface_films,
    )
}


def dataset_registry() -> Mapping[str, DatasetSpec]:
    """Return the immutable-by-convention code-side dataset registry."""
    return _REGISTRY


def dataset_spec(slug: str, registry: Mapping[str, DatasetSpec] | None = None) -> DatasetSpec | None:
    specs = _REGISTRY if registry is None else registry
    return specs.get(slug)
