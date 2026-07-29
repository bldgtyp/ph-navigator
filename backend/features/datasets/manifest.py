"""Manifest-pinned reads from the private R2/MinIO dataset namespace."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Protocol

from botocore.exceptions import ClientError
from pydantic import ValidationError

from config import settings
from features.assets.storage_r2 import R2Client
from features.datasets.models import DatasetManifest, PublishedDataset

MANIFEST_KEY = "datasets/manifest.json"


class DatasetManifestUnavailableError(RuntimeError):
    """The dataset manifest or requested slug is not published."""


class DatasetManifestInvalidError(RuntimeError):
    """The published manifest is malformed or violates key invariants."""


class DatasetObjectUnavailableError(RuntimeError):
    """A valid manifest points to an object that is not present."""


class DatasetIntegrityError(RuntimeError):
    """Published bytes do not match their manifest checksum."""


class DatasetObjectStore(Protocol):
    """The one object-store operation required by licensed dataset readers."""

    def get_object(self, object_key: str) -> bytes: ...


@dataclass(frozen=True)
class FetchedDataset:
    """Verified bytes and their immutable manifest pointer."""

    slug: str
    entry: PublishedDataset
    payload: bytes


def _is_not_found(error: ClientError) -> bool:
    code = str(error.response.get("Error", {}).get("Code", ""))
    return code in {"404", "NoSuchKey", "NotFound"}


class DatasetManifestStore:
    """Fetch, validate, cache, and resolve the published dataset manifest."""

    def __init__(self, storage: DatasetObjectStore) -> None:
        self._storage = storage
        self._manifest: DatasetManifest | None = None

    @classmethod
    def from_settings(cls) -> DatasetManifestStore:
        return cls(R2Client(settings))

    def reset(self) -> None:
        """Drop this store's parsed manifest cache."""
        self._manifest = None

    def manifest(self) -> DatasetManifest:
        """Return the cached validated manifest, fetching it once if needed."""
        if self._manifest is not None:
            return self._manifest
        try:
            raw = self._storage.get_object(MANIFEST_KEY)
        except ClientError as error:
            if _is_not_found(error):
                raise DatasetManifestUnavailableError("No licensed dataset manifest is published.") from error
            raise
        try:
            payload = json.loads(raw)
            self._manifest = DatasetManifest.model_validate(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as error:
            raise DatasetManifestInvalidError("The licensed dataset manifest is invalid.") from error
        return self._manifest

    def fetch(self, slug: str) -> FetchedDataset:
        """Fetch one manifest-pinned object and enforce its SHA-256."""
        entry = self.manifest().datasets.get(slug)
        if entry is None:
            raise DatasetManifestUnavailableError(f"No dataset is published for slug {slug!r}.")
        try:
            payload = self._storage.get_object(entry.key)
        except ClientError as error:
            if _is_not_found(error):
                raise DatasetObjectUnavailableError(
                    f"Dataset {slug!r} version {entry.version!r} is missing from the object store."
                ) from error
            raise
        actual = hashlib.sha256(payload).hexdigest()
        if actual != entry.sha256:
            raise DatasetIntegrityError(
                f"Dataset {slug!r} version {entry.version!r} failed its SHA-256 integrity check."
            )
        return FetchedDataset(slug=slug, entry=entry, payload=payload)
