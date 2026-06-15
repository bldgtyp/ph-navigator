"""The two-stage climate process→seed pipeline (PRD D-CS-3/D-CS-4).

Covers the seams Phase 1 adds on top of the shipped Climate store: the
standardized bundle envelope and its JSON round-trip, the object-store
resolver (over the in-memory ``FakeR2Client``), the provider-agnostic
seed-from-bundle path and its idempotency, and a structural guard asserting
no licensed source data is tracked in this public repo.
"""

from __future__ import annotations

import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest

from database import connection
from features.climate.bundle import BUNDLE_KIND, BUNDLE_SCHEMA_VERSION, ClimateBundle
from features.climate.object_store import ClimateBundleStore, bundle_object_key
from features.climate.processing import build_bundle, write_bundle_file
from features.climate.seeding import seed_all_from_object_store, seed_from_bundle, seed_from_object_store
from tests.test_assets_service import FakeR2Client

# The SYNTHETIC golden station (fabricated numbers) is the only climate source
# file this public repo may track; see test_climate_datasets.py + the
# no-licensed-data guard at the bottom of this module.
_FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "climate" / "phius"
_STATION_ID = "PHN_SYNTHETIC_TEST_STATION_ZZ"
_FIXED_TS = "2026-01-01T00:00:00Z"
_REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture()
def clean_climate_tables() -> Iterator[None]:
    """Truncate the app-wide reference dataset tables around each test."""
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with connection() as conn:
        conn.execute("TRUNCATE climate_dataset CASCADE")


def _fixture_bundle() -> ClimateBundle:
    """The synthetic Phius fixture as a standardized bundle (fixed timestamp)."""
    return build_bundle("phius", "2022", _FIXTURE_ROOT, exported_at=_FIXED_TS)


def _phi_bundle() -> ClimateBundle:
    """A second-provider bundle (phi/10.6) reusing the synthetic records.

    The records are generic ``ClimateRecord``s, so relabelling the Phius
    fixture as ``phi`` gives a valid, licensed-data-free bundle for exercising
    the provider-agnostic ``--all`` path without a PHI workbook fixture.
    """
    return _fixture_bundle().model_copy(
        update={"provider": "phi", "version": "10.6", "label": "PHI 10.6", "source": "PHI test bundle"}
    )


# --- Process: build_bundle --------------------------------------------------


def test_build_bundle_from_fixture_tree() -> None:
    bundle = _fixture_bundle()

    assert bundle.kind == BUNDLE_KIND
    assert bundle.schema_version == BUNDLE_SCHEMA_VERSION
    assert bundle.provider == "phius"
    assert bundle.version == "2022"
    assert bundle.label == "Phius 2022"
    assert bundle.source == "Phius monthly climate data (-mon.txt)"
    assert bundle.exported_at == _FIXED_TS
    assert len(bundle.records) == 1
    assert bundle.records[0].station_id == _STATION_ID


def test_build_bundle_rejects_empty_tree(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="No phius stations found"):
        build_bundle("phius", "2022", tmp_path)


# --- Bundle: JSON round-trip ------------------------------------------------


def test_bundle_round_trips_through_json() -> None:
    bundle = _fixture_bundle()
    rebuilt = ClimateBundle.from_json_bytes(bundle.to_json_bytes())
    assert rebuilt.model_dump() == bundle.model_dump()


def test_write_bundle_file_round_trip(tmp_path: Path) -> None:
    bundle = _fixture_bundle()
    out = tmp_path / "climate" / "phius" / "2022" / "dataset.json"
    write_bundle_file(bundle, out)

    assert out.is_file()
    rebuilt = ClimateBundle.from_json_bytes(out.read_bytes())
    assert rebuilt.model_dump() == bundle.model_dump()


# --- Object-store resolver --------------------------------------------------


def test_bundle_store_put_get_round_trip() -> None:
    bundle = _fixture_bundle()
    fake = FakeR2Client()
    store = ClimateBundleStore(fake)

    store.put_bundle(bundle)
    # Stored under the D-CS-4 key layout, content-typed as JSON.
    key = bundle_object_key("phius", "2022")
    assert key == "climate/phius/2022/dataset.json"
    assert fake.objects[key][1] == "application/json"

    rebuilt = store.get_bundle("phius", "2022")
    assert rebuilt.model_dump() == bundle.model_dump()


# --- Seed: provider-agnostic seed-from-bundle -------------------------------


def test_seed_from_bundle_is_idempotent(clean_climate_tables: None) -> None:
    bundle = _fixture_bundle()

    first = seed_from_bundle(bundle)
    assert first.location_count == 1
    assert first.replaced is False

    second = seed_from_bundle(bundle)
    assert second.location_count == 1
    assert second.replaced is True
    # Re-seed replaces in place: still exactly one dataset, one location.
    assert second.dataset_id != first.dataset_id

    with connection() as conn:
        datasets = conn.execute("SELECT count(*) AS n FROM climate_dataset").fetchone()
        locations = conn.execute("SELECT count(*) AS n FROM climate_dataset_location").fetchone()
    assert datasets is not None and datasets["n"] == 1
    assert locations is not None and locations["n"] == 1


def test_seed_from_bundle_skips_when_replace_false(clean_climate_tables: None) -> None:
    bundle = _fixture_bundle()
    seed_from_bundle(bundle)
    result = seed_from_bundle(bundle, replace=False)
    assert result.replaced is False
    assert result.location_count == 1


def test_seed_from_object_store_lands_golden_values(clean_climate_tables: None) -> None:
    store = ClimateBundleStore(FakeR2Client())
    store.put_bundle(_fixture_bundle())

    result = seed_from_object_store(store, "phius", "2022")
    assert result.provider == "phius"
    assert result.version == "2022"
    assert result.location_count == 1

    with connection() as conn:
        row = conn.execute(
            "SELECT station_id, data FROM climate_dataset_location WHERE station_id = %(s)s",
            {"s": _STATION_ID},
        ).fetchone()
    assert row is not None
    # The standardized record survives the bundle → object store → Postgres trip.
    assert row["data"]["climate"]["monthly_radiation"]["glob"][6] == pytest.approx(160.0)


# --- Seed: --all (every published provider) --------------------------------


def test_seed_all_seeds_every_published_provider(clean_climate_tables: None) -> None:
    store = ClimateBundleStore(FakeR2Client())
    store.put_bundle(_fixture_bundle())
    store.put_bundle(_phi_bundle())

    seeded, skipped = seed_all_from_object_store(store)

    assert {(r.provider, r.version) for r in seeded} == {("phius", "2022"), ("phi", "10.6")}
    assert skipped == []
    with connection() as conn:
        datasets = conn.execute("SELECT count(*) AS n FROM climate_dataset").fetchone()
    assert datasets is not None and datasets["n"] == 2


def test_seed_all_skips_unpublished_providers(clean_climate_tables: None) -> None:
    # Only phius is published; phi is registered but its bundle is not uploaded.
    store = ClimateBundleStore(FakeR2Client())
    store.put_bundle(_fixture_bundle())

    seeded, skipped = seed_all_from_object_store(store)

    assert [(r.provider, r.version) for r in seeded] == [("phius", "2022")]
    assert skipped == [("phi", "10.6")]
    with connection() as conn:
        datasets = conn.execute("SELECT count(*) AS n FROM climate_dataset").fetchone()
    assert datasets is not None and datasets["n"] == 1


def test_seed_all_reports_nothing_when_store_empty(clean_climate_tables: None) -> None:
    # An empty store seeds nothing and skips every registered provider; the CLI
    # turns this empty result into a loud failure (see seeding.main).
    seeded, skipped = seed_all_from_object_store(ClimateBundleStore(FakeR2Client()))

    assert seeded == []
    assert {pair[0] for pair in skipped} == {"phius", "phi"}


# --- Guard: no licensed climate source data tracked in this PUBLIC repo -----


def _tracked_under(path: str) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", path],
        cwd=_REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def test_no_licensed_climate_source_tracked() -> None:
    # backend/seeds/climate/ holds the operator's local source tree, which is
    # gitignored — only its README may be tracked.
    seed_files = _tracked_under("backend/seeds/climate")
    assert all(path.endswith("README.md") for path in seed_files), (
        f"unexpected tracked files under backend/seeds/climate: {seed_files}"
    )

    # The only climate fixture the repo may ship is the synthetic golden station.
    fixture_files = _tracked_under("backend/tests/fixtures/climate")
    assert all(path.endswith(f"{_STATION_ID}-mon.txt") for path in fixture_files), (
        f"unexpected tracked climate fixtures: {fixture_files}"
    )
