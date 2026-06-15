"""The dev climate-bundle bootstrap decision logic (`scripts.seed_climate_bundle`).

Covers the Phase-1.1 rule: only an *explicit* ``CLIMATE_SOURCE_DIR`` may
overwrite a published bundle, so a plain ``make db-reset-dev`` never clobbers
the full library with the default 24-station slice. Exercised through
``ensure_bundle`` over the in-memory ``FakeR2Client`` and the synthetic Phius
fixture (no licensed data).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from features.climate.object_store import ClimateBundleStore
from features.climate.processing import build_bundle
from scripts.seed_climate_bundle import ensure_bundle
from tests.test_assets_service import FakeR2Client

_FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "climate" / "phius"


def _fixture_store(*, with_bundle_label: str | None = None) -> ClimateBundleStore:
    """A FakeR2Client-backed store, optionally pre-seeded with a labelled bundle."""
    store = ClimateBundleStore(FakeR2Client())
    if with_bundle_label is not None:
        seed = build_bundle("phius", "2022", _FIXTURE_ROOT).model_copy(update={"label": with_bundle_label})
        store.put_bundle(seed)
    return store


def test_ensure_bundle_reuses_published_bundle_without_override() -> None:
    # A bundle is already published; no CLIMATE_SOURCE_DIR → must NOT rebuild.
    store = _fixture_store(with_bundle_label="SENTINEL FULL BUNDLE")

    msg = ensure_bundle(store, explicit_source=None)

    assert "using existing" in msg
    # The sentinel survives — the default slice did not clobber it.
    assert store.get_bundle("phius", "2022").label == "SENTINEL FULL BUNDLE"


def test_ensure_bundle_rebuilds_from_explicit_source() -> None:
    store = _fixture_store()  # empty

    msg = ensure_bundle(store, explicit_source=str(_FIXTURE_ROOT))

    assert "uploaded phius/2022" in msg
    assert store.has_bundle("phius", "2022")


def test_ensure_bundle_explicit_source_overwrites_existing() -> None:
    # An explicit source is the operator's deliberate "publish this tree" — it
    # replaces whatever was there (the intended, non-accidental clobber).
    store = _fixture_store(with_bundle_label="SENTINEL FULL BUNDLE")

    ensure_bundle(store, explicit_source=str(_FIXTURE_ROOT))

    assert store.get_bundle("phius", "2022").label == "Phius 2022"


def test_ensure_bundle_raises_without_source_or_bundle(tmp_path: Path) -> None:
    store = _fixture_store()  # empty
    with pytest.raises(SystemExit, match="No Phius source"):
        ensure_bundle(store, explicit_source=str(tmp_path))  # empty dir → nothing to build
