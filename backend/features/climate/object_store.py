"""Object-store home for the standardized climate bundles (PRD D-CS-2 / D-CS-4).

The source-of-truth for reference climate data is the private, S3-compatible
object store — MinIO locally, Cloudflare R2 in deployment — never git, because
the repo is public and the data is licensed (PRD D-CS-2). This module owns the
key layout and the thin upload/download of a
:class:`~features.climate.bundle.ClimateBundle` over the shared storage
abstraction (:class:`features.assets.service.AssetStorage`, satisfied by both
the production ``R2Client`` and the test fake).

Key layout (PRD D-CS-4)::

    climate/<provider>/<version>/dataset.json   # the standardized seed input
    climate/<provider>/<version>/raw/…          # optional raw archive (provenance)
"""

from __future__ import annotations

from botocore.exceptions import ClientError

from features.assets.service import AssetStorage
from features.climate.bundle import ClimateBundle

_BUNDLE_CONTENT_TYPE = "application/json"


def bundle_object_key(provider: str, version: str) -> str:
    """Object key for one ``(provider, version)`` standardized bundle."""
    return f"climate/{provider}/{version}/dataset.json"


class ClimateBundleStore:
    """Read/write standardized climate bundles in the object store."""

    def __init__(self, storage: AssetStorage) -> None:
        self._storage = storage

    def put_bundle(self, bundle: ClimateBundle) -> str:
        """Upload ``bundle`` under its ``(provider, version)`` key; returns the ETag."""
        key = bundle_object_key(bundle.provider, bundle.version)
        return self._storage.put_object(key, bundle.to_json_bytes(), _BUNDLE_CONTENT_TYPE)

    def get_bundle(self, provider: str, version: str) -> ClimateBundle:
        """Download + validate the standardized bundle for ``(provider, version)``."""
        raw = self._storage.get_object(bundle_object_key(provider, version))
        return ClimateBundle.from_json_bytes(raw)

    def has_bundle(self, provider: str, version: str) -> bool:
        """Whether a bundle exists for ``(provider, version)`` (cheap HEAD, no download)."""
        try:
            self._storage.head_object(bundle_object_key(provider, version))
        except ClientError:
            return False
        return True
