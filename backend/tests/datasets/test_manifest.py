"""Manifest parsing and integrity tests use invented payloads only."""

from __future__ import annotations

import hashlib
import json

import pytest
from botocore.exceptions import ClientError

from features.datasets.manifest import (
    MANIFEST_KEY,
    DatasetIntegrityError,
    DatasetManifestInvalidError,
    DatasetManifestStore,
    DatasetManifestUnavailableError,
    DatasetObjectUnavailableError,
)

_SLUG = "synthetic-table"
_KEY = f"datasets/{_SLUG}/1/dataset.json"
_PAYLOAD = b'{"rows":[{"id":"invented","value":1}]}\n'


class FakeStorage:
    def __init__(self, objects: dict[str, bytes] | None = None) -> None:
        self.objects = dict(objects or {})
        self.reads: list[str] = []

    def get_object(self, object_key: str) -> bytes:
        self.reads.append(object_key)
        try:
            return self.objects[object_key]
        except KeyError as error:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject") from error


def manifest_bytes(*, sha256: str | None = None, extra: dict[str, object] | None = None) -> bytes:
    payload: dict[str, object] = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            _SLUG: {
                "version": "1",
                "sha256": sha256 or hashlib.sha256(_PAYLOAD).hexdigest(),
                "key": _KEY,
            }
        },
    }
    if extra:
        payload.update(extra)
    return json.dumps(payload).encode()


def test_manifest_is_parsed_and_cached() -> None:
    storage = FakeStorage({MANIFEST_KEY: manifest_bytes()})
    store = DatasetManifestStore(storage)

    first = store.manifest()
    second = store.manifest()

    assert first is second
    assert first.datasets[_SLUG].key == _KEY
    assert storage.reads == [MANIFEST_KEY]


def test_fetch_verifies_the_manifest_checksum() -> None:
    storage = FakeStorage({MANIFEST_KEY: manifest_bytes(), _KEY: _PAYLOAD})

    fetched = DatasetManifestStore(storage).fetch(_SLUG)

    assert fetched.payload == _PAYLOAD
    assert fetched.entry.version == "1"


def test_checksum_mismatch_is_a_typed_hard_error() -> None:
    storage = FakeStorage({MANIFEST_KEY: manifest_bytes(), _KEY: b"different synthetic bytes"})

    with pytest.raises(DatasetIntegrityError):
        DatasetManifestStore(storage).fetch(_SLUG)


def test_absent_manifest_is_typed_unavailable() -> None:
    with pytest.raises(DatasetManifestUnavailableError):
        DatasetManifestStore(FakeStorage()).manifest()


def test_missing_manifest_pinned_object_is_not_manifest_unavailable() -> None:
    storage = FakeStorage({MANIFEST_KEY: manifest_bytes()})

    with pytest.raises(DatasetObjectUnavailableError):
        DatasetManifestStore(storage).fetch(_SLUG)


def test_invalid_manifest_error_does_not_echo_payload() -> None:
    storage = FakeStorage({MANIFEST_KEY: b'{"generated_at":"not-a-date","datasets":{}}'})

    with pytest.raises(DatasetManifestInvalidError) as caught:
        DatasetManifestStore(storage).manifest()

    assert "not-a-date" not in str(caught.value)
