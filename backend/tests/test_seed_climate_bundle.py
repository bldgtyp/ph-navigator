"""The dev climate-bundle bootstrap decision logic (`scripts.seed_climate_bundle`).

Covers the Phase-1.1 rule (only an *explicit* source env may overwrite a
published bundle, so a plain ``make db-reset-dev`` never clobbers the full
library with a default slice) and the multi-provider bootstrap: Phius is
required (fails loudly when nothing is buildable or published) while PHI is
optional (skipped gracefully). Exercised through ``ensure_bundle`` over the
in-memory ``FakeR2Client`` and the synthetic Phius fixture (no licensed data).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from features.climate.object_store import ClimateBundleStore
from features.climate.processing import build_bundle
from scripts.seed_climate_bundle import _BundleSpec, ensure_bundle
from tests.test_assets_service import FakeR2Client

_FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "climate" / "phius"

# The synthetic Phius fixture stands in for the (gitignored) local source tree.
_PHIUS_SPEC = _BundleSpec("phius", "2022", _FIXTURE_ROOT, "CLIMATE_SOURCE_DIR", required=True)


def _phi_spec(default_root: Path) -> _BundleSpec:
    """An optional PHI spec whose default source is ``default_root`` (no committed .xlsx)."""
    return _BundleSpec("phi", "10.6", default_root, "CLIMATE_PHI_SOURCE_DIR", required=False)


def _fixture_store(*, with_bundle_label: str | None = None) -> ClimateBundleStore:
    """A FakeR2Client-backed store, optionally pre-seeded with a labelled Phius bundle."""
    store = ClimateBundleStore(FakeR2Client())
    if with_bundle_label is not None:
        seed = build_bundle("phius", "2022", _FIXTURE_ROOT).model_copy(update={"label": with_bundle_label})
        store.put_bundle(seed)
    return store


def _put_phi_bundle(store: ClimateBundleStore, *, label: str) -> None:
    """Publish a phi-keyed bundle (no licensed .xlsx needed — only the key/identity matters)."""
    phi = build_bundle("phius", "2022", _FIXTURE_ROOT).model_copy(
        update={"provider": "phi", "version": "10.6", "label": label}
    )
    store.put_bundle(phi)


def test_ensure_bundle_reuses_published_bundle_without_override() -> None:
    # A bundle is already published; no source env → must NOT rebuild.
    store = _fixture_store(with_bundle_label="SENTINEL FULL BUNDLE")

    msg = ensure_bundle(store, _PHIUS_SPEC, explicit_source=None)

    assert "using existing" in msg
    # The sentinel survives — the default slice did not clobber it.
    assert store.get_bundle("phius", "2022").label == "SENTINEL FULL BUNDLE"


def test_ensure_bundle_rebuilds_from_explicit_source() -> None:
    store = _fixture_store()  # empty

    msg = ensure_bundle(store, _PHIUS_SPEC, explicit_source=str(_FIXTURE_ROOT))

    assert "uploaded phius/2022" in msg
    assert store.has_bundle("phius", "2022")


def test_ensure_bundle_explicit_source_overwrites_existing() -> None:
    # An explicit source is the operator's deliberate "publish this tree" — it
    # replaces whatever was there (the intended, non-accidental clobber).
    store = _fixture_store(with_bundle_label="SENTINEL FULL BUNDLE")

    ensure_bundle(store, _PHIUS_SPEC, explicit_source=str(_FIXTURE_ROOT))

    assert store.get_bundle("phius", "2022").label == "Phius 2022"


def test_ensure_bundle_raises_for_required_provider_without_source_or_bundle(tmp_path: Path) -> None:
    store = _fixture_store()  # empty
    with pytest.raises(SystemExit, match="No phius source"):
        ensure_bundle(store, _PHIUS_SPEC, explicit_source=str(tmp_path))  # empty dir → nothing to build


def test_ensure_bundle_skips_optional_provider_without_source_or_bundle(tmp_path: Path) -> None:
    # PHI is optional: a dev without the licensed .xlsx (and no published bundle)
    # gets a graceful skip, not a hard failure.
    store = _fixture_store()  # empty
    msg = ensure_bundle(store, _phi_spec(tmp_path / "phi"), explicit_source=None)

    assert "skipped phi/10.6" in msg
    assert not store.has_bundle("phi", "10.6")


def test_ensure_bundle_reuses_published_optional_bundle(tmp_path: Path) -> None:
    # PHI already published (e.g. uploaded once from the licensed workbook): a
    # reset reuses it without needing the source on disk.
    store = _fixture_store()
    _put_phi_bundle(store, label="SENTINEL PHI BUNDLE")

    msg = ensure_bundle(store, _phi_spec(tmp_path / "phi"), explicit_source=None)

    assert "using existing phi/10.6" in msg
    assert store.get_bundle("phi", "10.6").label == "SENTINEL PHI BUNDLE"
