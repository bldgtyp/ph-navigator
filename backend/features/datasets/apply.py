"""Idempotent fetch/parse/apply/audit orchestration for db-seed datasets."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from psycopg import Connection

from features.datasets import repository
from features.datasets.manifest import DatasetManifestStore
from features.datasets.models import DatasetApplyResult
from features.datasets.registry import DatasetSpec, dataset_registry


class DatasetApplyError(RuntimeError):
    """A requested dataset cannot be safely applied."""


def apply_dataset(
    conn: Connection[Any],
    *,
    slug: str,
    applied_by: str,
    store: DatasetManifestStore,
    registry: Mapping[str, DatasetSpec] | None = None,
) -> DatasetApplyResult:
    """Apply one complete db-seed dataset and refresh its audit row.

    Each apply owns a savepoint so a target-identity mismatch rolls back any
    writes performed before the applier discovered the unmatched rows. A
    partial apply must never be recorded as the published version.
    """
    specs = dataset_registry() if registry is None else registry
    spec = specs.get(slug)
    if spec is None:
        raise DatasetApplyError(f"Dataset {slug!r} is not registered in this PH-Navigator build.")
    if spec.kind != "db_seed" or spec.apply is None:
        raise DatasetApplyError(f"Dataset {slug!r} is not a db-seed dataset.")
    fetched = store.fetch(slug)
    parsed = spec.parse(fetched.payload)
    with conn.transaction():
        repository.lock_dataset(conn, slug)
        report = spec.apply(conn, parsed)
        if report.unmatched:
            raise DatasetApplyError(
                f"Dataset {slug!r} matched {report.matched} target rows but "
                f"{len(report.unmatched)} targets were unmatched; the apply was rolled back."
            )
        if not repository.record_applied(
            conn,
            slug=slug,
            version=fetched.entry.version,
            sha256=fetched.entry.sha256,
            applied_by=applied_by,
        ):
            raise DatasetApplyError(f"Dataset {slug!r} version {fetched.entry.version!r} has conflicting audit state.")
    return DatasetApplyResult(
        slug=slug,
        version=fetched.entry.version,
        sha256=fetched.entry.sha256,
        report=report,
    )


def apply_all_pending(
    conn: Connection[Any],
    *,
    applied_by: str,
    store: DatasetManifestStore,
    registry: Mapping[str, DatasetSpec] | None = None,
) -> tuple[DatasetApplyResult, ...]:
    """Apply every known db-seed whose published version is not latest-applied."""
    specs = dataset_registry() if registry is None else registry
    manifest = store.manifest()
    results: list[DatasetApplyResult] = []
    for slug, entry in sorted(manifest.datasets.items()):
        spec = specs.get(slug)
        if spec is None or spec.kind != "db_seed":
            continue
        applied = repository.latest_applied(conn, slug)
        if applied is not None and applied["version"] == entry.version and applied["sha256"] == entry.sha256:
            continue
        results.append(
            apply_dataset(
                conn,
                slug=slug,
                applied_by=applied_by,
                store=store,
                registry=specs,
            )
        )
    return tuple(results)
