"""Registry/manifest mismatch matrix tests."""

from __future__ import annotations

import hashlib
import json
from typing import Any, cast

import pytest
from psycopg import Connection

from features.datasets import repository
from features.datasets.manifest import MANIFEST_KEY, DatasetManifestStore
from features.datasets.models import ApplyReport
from features.datasets.registry import DatasetSpec
from features.datasets.service import datasets_status
from tests.datasets.test_manifest import FakeStorage

_PAYLOAD = b'{"value":"invented"}\n'


def _store(entries: dict[str, dict[str, str]], objects: dict[str, bytes]) -> DatasetManifestStore:
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": entries,
    }
    return DatasetManifestStore(
        FakeStorage(
            {
                MANIFEST_KEY: json.dumps(manifest).encode(),
                **objects,
            }
        )
    )


def _entry(slug: str, version: str = "1", payload: bytes = _PAYLOAD) -> dict[str, str]:
    return {
        "version": version,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "key": f"datasets/{slug}/{version}/dataset.json",
    }


def _runtime_spec(slug: str) -> DatasetSpec:
    return DatasetSpec(slug=slug, kind="runtime_read", parse=lambda payload: payload)


def _db_spec(slug: str) -> DatasetSpec:
    def apply(conn: Connection[Any], payload: object) -> ApplyReport:
        del conn, payload
        return ApplyReport()

    return DatasetSpec(
        slug=slug,
        kind="db_seed",
        parse=lambda payload: payload,
        apply=apply,
    )


def _unused_conn() -> Connection[Any]:
    return cast(Connection[Any], object())


def test_data_ahead_of_code_is_reported() -> None:
    slug = "unknown-table"
    entry = _entry(slug)

    summary = datasets_status(
        _unused_conn(),
        store=_store({slug: entry}, {entry["key"]: _PAYLOAD}),
        registry={},
    )

    assert summary.items[0].mismatches == ("data_ahead_of_code",)


def test_code_ahead_of_data_is_reported_when_manifest_is_absent() -> None:
    slug = "known-table"

    summary = datasets_status(
        _unused_conn(),
        store=DatasetManifestStore(FakeStorage()),
        registry={slug: _runtime_spec(slug)},
    )

    assert summary.items[0].mismatches == ("code_ahead_of_data",)


def test_checksum_mismatch_is_reported() -> None:
    slug = "known-table"
    entry = _entry(slug)

    summary = datasets_status(
        _unused_conn(),
        store=_store({slug: entry}, {entry["key"]: b"corrupted synthetic bytes"}),
        registry={slug: _runtime_spec(slug)},
    )

    assert summary.items[0].mismatches == ("checksum_mismatch",)


def test_runtime_loaded_version_mismatch_is_reported() -> None:
    slug = "known-table"
    entry = _entry(slug, version="2")

    summary = datasets_status(
        _unused_conn(),
        store=_store({slug: entry}, {entry["key"]: _PAYLOAD}),
        registry={slug: _runtime_spec(slug)},
        loaded_versions={slug: "1"},
    )

    assert summary.items[0].mismatches == ("runtime_version_mismatch",)


def test_runtime_status_loads_and_reports_the_published_version() -> None:
    slug = "known-table"
    entry = _entry(slug)

    summary = datasets_status(
        _unused_conn(),
        store=_store({slug: entry}, {entry["key"]: _PAYLOAD}),
        registry={slug: _runtime_spec(slug)},
    )

    assert summary.items[0].applied_or_loaded_version == "1"
    assert summary.items[0].mismatches == ()


def test_unapplied_db_seed_is_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    slug = "known-table"
    entry = _entry(slug)

    def no_applied(conn: Connection[Any], requested_slug: str) -> None:
        del conn, requested_slug

    monkeypatch.setattr(repository, "latest_applied", no_applied)

    summary = datasets_status(
        _unused_conn(),
        store=_store({slug: entry}, {entry["key"]: _PAYLOAD}),
        registry={slug: _db_spec(slug)},
    )

    assert summary.items[0].mismatches == ("unapplied_pending",)
