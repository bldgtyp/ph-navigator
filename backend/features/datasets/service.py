"""Registry/manifest reconciliation for dataset operator tooling."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from psycopg import Connection

from features.datasets import repository
from features.datasets.manifest import (
    DatasetIntegrityError,
    DatasetManifestStore,
    DatasetManifestUnavailableError,
    DatasetObjectUnavailableError,
)
from features.datasets.models import DatasetMismatch, DatasetStatusItem, DatasetStatusSummary
from features.datasets.registry import DatasetSpec, dataset_registry


class DatasetPayloadInvalidError(RuntimeError):
    """A checksum-valid runtime dataset cannot be parsed by its registry spec."""


def datasets_status(
    conn: Connection[Any],
    *,
    store: DatasetManifestStore,
    loaded_versions: Mapping[str, str] | None = None,
    registry: Mapping[str, DatasetSpec] | None = None,
) -> DatasetStatusSummary:
    """Reconcile code registry, published manifest, checksums, and applied state."""
    specs = dataset_registry() if registry is None else registry
    loaded = loaded_versions or {}
    try:
        published = store.manifest().datasets
    except DatasetManifestUnavailableError:
        published = {}
    slugs = sorted(set(specs) | set(published))
    items: list[DatasetStatusItem] = []

    for slug in slugs:
        spec = specs.get(slug)
        entry = published.get(slug)
        mismatches: list[DatasetMismatch] = []
        current_version: str | None = None
        fetched_payload: bytes | None = None

        if entry is not None:
            try:
                fetched_payload = store.fetch(slug).payload
            except (DatasetIntegrityError, DatasetObjectUnavailableError):
                mismatches.append("checksum_mismatch")

        if spec is None:
            mismatches.append("data_ahead_of_code")
        elif entry is None:
            mismatches.append("code_ahead_of_data")
        elif spec.kind == "runtime_read":
            current_version = loaded.get(slug)
            if current_version is None and fetched_payload is not None:
                try:
                    spec.parse(fetched_payload)
                except Exception as error:
                    raise DatasetPayloadInvalidError(
                        f"Dataset {slug!r} passed integrity checks but its payload is invalid."
                    ) from error
                current_version = entry.version
            if current_version is not None and current_version != entry.version:
                mismatches.append("runtime_version_mismatch")
        else:
            applied = repository.latest_applied(conn, slug)
            current_version = str(applied["version"]) if applied is not None else None
            if applied is None or applied["version"] != entry.version or applied["sha256"] != entry.sha256:
                mismatches.append("unapplied_pending")

        items.append(
            DatasetStatusItem(
                slug=slug,
                kind=spec.kind if spec is not None else None,
                published_version=entry.version if entry is not None else None,
                applied_or_loaded_version=current_version,
                sha256=entry.sha256 if entry is not None else None,
                mismatches=tuple(mismatches),
            )
        )
    return DatasetStatusSummary(items=tuple(items))
