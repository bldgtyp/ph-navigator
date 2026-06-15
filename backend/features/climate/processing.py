"""The admin-only *process* step: raw source → standardized bundle (PRD D-CS-3).

Parsing is the load-bearing, provider-specific work (Phius mojibake; the PHI
~130-column workbook). It runs *rarely*, offline, by an operator — never on the
seed path and never behind an API route. The output is a single standardized
:class:`~features.climate.bundle.ClimateBundle`, optionally uploaded to the
private object store, which is the only artifact the seed step
(:mod:`features.climate.seeding`) ever reads.

    uv run python -m features.climate.processing \\
        --provider phius --version 2022 \\
        --src /path/to/phius_2022_climate_data \\
        --out climate/phius/2022/dataset.json --upload

Run from ``backend/`` so the project ``Settings`` (object-store credentials)
load. ``--upload`` targets MinIO locally and Cloudflare R2 in deployment via
the same ``R2_*`` settings.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
from pathlib import Path

from config import settings
from features.assets.storage_r2 import R2Client
from features.climate.bundle import ClimateBundle
from features.climate.importers import get_provider, provider_names, resolve_version
from features.climate.object_store import ClimateBundleStore, bundle_object_key


class EmptySourceError(ValueError):
    """Raised when a source tree yields no stations.

    Distinct from a parse failure: callers (e.g. the dev bundle bootstrap)
    treat "no local source" as a fall-through, but a malformed file must still
    surface. ``ValueError`` subclass so existing ``pytest.raises(ValueError)``
    expectations still hold.
    """


def build_bundle(provider: str, version: str, src: Path, *, exported_at: str | None = None) -> ClimateBundle:
    """Parse ``src`` with ``provider``'s parser into a standardized bundle.

    Raises :class:`EmptySourceError` if the tree yields no stations, so a
    mistyped ``--src`` (or an empty source dir) fails loudly instead of
    publishing an empty release that would later clobber a good one.
    """
    spec = get_provider(provider)
    records = list(spec.parse_tree(src))
    if not records:
        raise EmptySourceError(f"No {provider} stations found under {src}; refusing to build an empty bundle.")
    return ClimateBundle(
        provider=provider,
        version=version,
        label=spec.label_for(version),
        source=spec.source,
        exported_at=exported_at or _utc_now_iso(),
        records=records,
    )


def write_bundle_file(bundle: ClimateBundle, path: Path) -> None:
    """Write the standardized bundle to a local ``.json`` file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bundle.to_json_bytes())


def _upload_bundle(bundle: ClimateBundle) -> str:
    """Push the bundle to the object store; returns the object key."""
    if not settings.r2_endpoint_url:
        raise SystemExit(
            "R2_ENDPOINT_URL is required to --upload; start the object store with `make object-store-init`."
        )
    ClimateBundleStore(R2Client(settings)).put_bundle(bundle)
    return bundle_object_key(bundle.provider, bundle.version)


def _utc_now_iso() -> str:
    """Current UTC time as an ``…Z`` ISO-8601 stamp (matches the seed envelopes)."""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="features.climate.processing", description=__doc__)
    parser.add_argument(
        "--provider", choices=provider_names(), required=True, help="Reference-dataset provider to parse."
    )
    parser.add_argument("--src", type=Path, required=True, help="Raw source tree to parse.")
    parser.add_argument("--version", help="Dataset version tag (default: the provider's default).")
    parser.add_argument("--out", type=Path, help="Write the standardized bundle to this local path.")
    parser.add_argument("--upload", action="store_true", help="Upload the bundle to the object store.")
    args = parser.parse_args(argv)

    if args.out is None and not args.upload:
        parser.error("nothing to do: pass --out, --upload, or both.")
    if not args.src.is_dir():
        parser.error(f"--src is not a directory: {args.src}")

    version = resolve_version(args.provider, args.version)
    bundle = build_bundle(args.provider, version, args.src)
    print(f"processed {args.provider} {version}: {len(bundle.records)} stations")

    if args.out is not None:
        write_bundle_file(bundle, args.out)
        print(f"wrote bundle -> {args.out}")
    if args.upload:
        print(f"uploaded bundle -> {_upload_bundle(bundle)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
