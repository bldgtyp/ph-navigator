"""Report licensed dataset versions without printing payload values."""

from __future__ import annotations

from config import settings
from database import connection
from features.datasets.manifest import DatasetManifestInvalidError, DatasetManifestStore
from features.datasets.service import DatasetPayloadInvalidError, datasets_status
from features.envelope.surface_film_store import loaded_surface_film_versions


def main() -> int:
    if not settings.r2_endpoint_url:
        raise SystemExit("R2_ENDPOINT_URL is required; start local storage with `make object-store-init`.")
    store = DatasetManifestStore.from_settings()
    try:
        with connection() as conn:
            summary = datasets_status(
                conn,
                store=store,
                loaded_versions=loaded_surface_film_versions(),
            )
    except (DatasetManifestInvalidError, DatasetPayloadInvalidError) as error:
        raise SystemExit(str(error)) from error

    has_mismatch = False
    for item in summary.items:
        mismatches = ",".join(item.mismatches) if item.mismatches else "none"
        has_mismatch = has_mismatch or bool(item.mismatches)
        print(
            f"{item.slug} kind={item.kind or 'unknown'} "
            f"published={item.published_version or '-'} "
            f"applied_or_loaded={item.applied_or_loaded_version or '-'} "
            f"sha256={item.sha256 or '-'} mismatches={mismatches}"
        )
    return 1 if has_mismatch else 0


if __name__ == "__main__":
    raise SystemExit(main())
