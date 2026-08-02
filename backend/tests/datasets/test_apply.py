"""Db-seed apply orchestration and audit tests."""

from __future__ import annotations

import hashlib
import json
from typing import Any

import pytest
from psycopg import Connection

from database import transaction
from features.datasets import repository
from features.datasets.apply import DatasetApplyError, apply_all_pending, apply_dataset
from features.datasets.manifest import MANIFEST_KEY, DatasetManifestStore
from features.datasets.models import ApplyReport
from features.datasets.registry import DatasetSpec
from tests.datasets.test_manifest import FakeStorage

_SLUG = "synthetic-db-seed"
_PAYLOAD = b'{"rows":[{"id":"invented","value":1}]}\n'
_SHA256 = hashlib.sha256(_PAYLOAD).hexdigest()
_KEY = f"datasets/{_SLUG}/1/dataset.json"


class IdempotentSyntheticApplier:
    def __init__(self) -> None:
        self.applied = False

    def __call__(self, conn: Connection[Any], payload: object) -> ApplyReport:
        del conn, payload
        if self.applied:
            return ApplyReport(matched=1, unchanged=1)
        self.applied = True
        return ApplyReport(matched=1, updated=1)


def _store(*, include_unknown: bool = False) -> DatasetManifestStore:
    datasets: dict[str, dict[str, str]] = {
        _SLUG: {
            "version": "1",
            "sha256": _SHA256,
            "key": _KEY,
        }
    }
    objects = {_KEY: _PAYLOAD}
    if include_unknown:
        unknown_slug = "data-ahead"
        unknown_key = f"datasets/{unknown_slug}/1/dataset.json"
        datasets[unknown_slug] = {
            "version": "1",
            "sha256": _SHA256,
            "key": unknown_key,
        }
        objects[unknown_key] = _PAYLOAD
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": datasets,
    }
    return DatasetManifestStore(
        FakeStorage(
            {
                MANIFEST_KEY: json.dumps(manifest).encode(),
                **objects,
            }
        )
    )


def test_apply_is_idempotent_and_keeps_one_audit_row() -> None:
    applier = IdempotentSyntheticApplier()
    registry = {
        _SLUG: DatasetSpec(
            slug=_SLUG,
            kind="db_seed",
            parse=lambda payload: json.loads(payload),
            apply=applier,
        )
    }

    with transaction() as conn:
        conn.execute("DELETE FROM applied_datasets WHERE slug = %(slug)s", {"slug": _SLUG})
        first = apply_dataset(
            conn,
            slug=_SLUG,
            applied_by="first-run",
            store=_store(),
            registry=registry,
        )
        second = apply_dataset(
            conn,
            slug=_SLUG,
            applied_by="second-run",
            store=_store(),
            registry=registry,
        )
        row = conn.execute(
            """
            SELECT count(*) AS count, max(applied_by) AS applied_by
            FROM applied_datasets
            WHERE slug = %(slug)s
            """,
            {"slug": _SLUG},
        ).fetchone()

    assert first.report.updated == 1
    assert second.report.updated == 0
    assert second.report.unchanged == 1
    assert row == {"count": 1, "applied_by": "second-run"}


def test_apply_rolls_back_target_writes_and_audit_when_rows_are_unmatched(
    clean_catalog_tables: None,
) -> None:
    material_id = "rec-synthetic-rollback"

    def partially_apply(conn: Connection[Any], payload: object) -> ApplyReport:
        del payload
        conn.execute(
            """
            UPDATE catalog_materials
            SET vapor_diffusion_resistance_mu = 7.5
            WHERE id = %(id)s
            """,
            {"id": material_id},
        )
        return ApplyReport(
            matched=1,
            updated=1,
            unmatched=("rec-intentionally-unmatched",),
        )

    registry = {
        _SLUG: DatasetSpec(
            slug=_SLUG,
            kind="db_seed",
            parse=lambda payload: json.loads(payload),
            apply=partially_apply,
        )
    }
    with transaction() as conn:
        conn.execute(
            """
            INSERT INTO catalog_materials (id, name, category)
            VALUES (%(id)s, 'Synthetic rollback target', 'insulation')
            """,
            {"id": material_id},
        )
        conn.execute("DELETE FROM applied_datasets WHERE slug = %(slug)s", {"slug": _SLUG})

        with pytest.raises(DatasetApplyError, match="1 targets were unmatched; the apply was rolled back"):
            apply_dataset(
                conn,
                slug=_SLUG,
                applied_by="test",
                store=_store(),
                registry=registry,
            )

        material = conn.execute(
            """
            SELECT vapor_diffusion_resistance_mu
            FROM catalog_materials
            WHERE id = %(id)s
            """,
            {"id": material_id},
        ).fetchone()
        audit = repository.latest_applied(conn, _SLUG)

    assert material == {"vapor_diffusion_resistance_mu": None}
    assert audit is None


def test_all_pending_skips_unknown_manifest_slugs() -> None:
    applier = IdempotentSyntheticApplier()
    registry = {
        _SLUG: DatasetSpec(
            slug=_SLUG,
            kind="db_seed",
            parse=lambda payload: json.loads(payload),
            apply=applier,
        )
    }

    with transaction() as conn:
        conn.execute("DELETE FROM applied_datasets WHERE slug = %(slug)s", {"slug": _SLUG})
        results = apply_all_pending(
            conn,
            applied_by="test",
            store=_store(include_unknown=True),
            registry=registry,
        )

    assert [result.slug for result in results] == [_SLUG]


def test_apply_locks_the_slug_before_target_mutation(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[str] = []

    def lock(conn: Connection[Any], slug: str) -> None:
        del conn
        events.append(f"lock:{slug}")

    def apply(conn: Connection[Any], payload: object) -> ApplyReport:
        del conn, payload
        events.append(f"apply:{_SLUG}")
        return ApplyReport(matched=1, unchanged=1)

    monkeypatch.setattr(repository, "lock_dataset", lock)
    registry = {
        _SLUG: DatasetSpec(
            slug=_SLUG,
            kind="db_seed",
            parse=lambda payload: json.loads(payload),
            apply=apply,
        )
    }
    with transaction() as conn:
        conn.execute("DELETE FROM applied_datasets WHERE slug = %(slug)s", {"slug": _SLUG})
        apply_dataset(
            conn,
            slug=_SLUG,
            applied_by="test",
            store=_store(),
            registry=registry,
        )

    assert events == [f"lock:{_SLUG}", f"apply:{_SLUG}"]
