"""Licensed surface-film table loading.

The values used here are **invented test fixtures**, deliberately not the
real ASHRAE numbers — this repo is public and those are licensed. They only
have to be distinguishable from the ISO 6946 set for the assertions to mean
something.
"""

from __future__ import annotations

import hashlib
import json

import pytest
from botocore.exceptions import ClientError

from features.datasets.manifest import MANIFEST_KEY
from features.envelope.boundary_conditions import (
    ISO_6946_TABLE,
    SurfaceFilmTable,
    resolve_surface_resistances,
)
from features.envelope.surface_film_store import (
    SurfaceFilmStore,
    SurfaceFilmTableUnavailableError,
    parse_surface_film_payload,
    reset_surface_film_cache,
    surface_film_table,
)

_FIXTURE_PAYLOAD = {
    "standard": "ashrae",
    "rsi_by_direction": {"upward": 0.25, "horizontal": 0.35, "downward": 0.45},
    "rse_outdoor_air_m2k_w": 0.05,
    "source": "synthetic test fixture — invented values, no published standard",
}


class _FakeStorage:
    """Minimal stand-in for the R2/MinIO client, counting its reads."""

    def __init__(self, objects: dict[str, bytes] | None = None) -> None:
        self.objects = dict(objects or {})
        self.read_count = 0

    def get_object(self, object_key: str) -> bytes:
        self.read_count += 1
        try:
            return self.objects[object_key]
        except KeyError as error:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject") from error


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    reset_surface_film_cache()


def test_missing_object_reads_as_unpublished_not_an_error() -> None:
    assert SurfaceFilmStore(_FakeStorage()).get("ashrae") is None


def test_reads_the_manifest_pinned_dataset_and_tracks_its_version() -> None:
    payload = json.dumps(_FIXTURE_PAYLOAD).encode()
    key = "datasets/ashrae-surface-films/7/dataset.json"
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            "ashrae-surface-films": {
                "version": "7",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "key": key,
            }
        },
    }
    store = SurfaceFilmStore(
        _FakeStorage(
            {
                MANIFEST_KEY: json.dumps(manifest).encode(),
                key: payload,
            }
        )
    )

    table = store.get("ashrae")

    assert table == parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")
    assert store.loaded_version("ashrae") == "7"


def test_manifest_checksum_mismatch_is_typed_unavailable() -> None:
    payload = json.dumps(_FIXTURE_PAYLOAD).encode()
    key = "datasets/ashrae-surface-films/1/dataset.json"
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            "ashrae-surface-films": {
                "version": "1",
                "sha256": "0" * 64,
                "key": key,
            }
        },
    }
    storage = _FakeStorage(
        {
            MANIFEST_KEY: json.dumps(manifest).encode(),
            key: payload,
        }
    )

    with pytest.raises(SurfaceFilmTableUnavailableError):
        SurfaceFilmStore(storage).get("ashrae")

    assert storage.read_count == 2


def test_missing_manifest_pinned_object_is_typed_unavailable() -> None:
    payload = json.dumps(_FIXTURE_PAYLOAD).encode()
    key = "datasets/ashrae-surface-films/1/dataset.json"
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            "ashrae-surface-films": {
                "version": "1",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "key": key,
            }
        },
    }
    storage = _FakeStorage(
        {
            MANIFEST_KEY: json.dumps(manifest).encode(),
        }
    )

    with pytest.raises(SurfaceFilmTableUnavailableError):
        SurfaceFilmStore(storage).get("ashrae")

    assert storage.read_count == 2


def test_checksum_valid_malformed_json_is_typed_unavailable() -> None:
    payload = b"not-json"
    key = "datasets/ashrae-surface-films/1/dataset.json"
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            "ashrae-surface-films": {
                "version": "1",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "key": key,
            }
        },
    }
    storage = _FakeStorage(
        {
            MANIFEST_KEY: json.dumps(manifest).encode(),
            key: payload,
        }
    )

    with pytest.raises(SurfaceFilmTableUnavailableError):
        SurfaceFilmStore(storage).get("ashrae")


@pytest.mark.parametrize(
    "payload",
    [
        {"rse_outdoor_air_m2k_w": 0.05},
        {"rsi_by_direction": {"upward": 0.25}, "rse_outdoor_air_m2k_w": 0.05},
        {"rsi_by_direction": {"upward": 0, "horizontal": 0.35, "downward": 0.45}, "rse_outdoor_air_m2k_w": 0.05},
        {"rsi_by_direction": {"upward": 0.25, "horizontal": 0.35, "downward": 0.45}},
        "not-an-object",
    ],
)
def test_malformed_payloads_are_rejected(payload: object) -> None:
    with pytest.raises(SurfaceFilmTableUnavailableError):
        parse_surface_film_payload(payload, "ashrae")


def test_iso_resolves_from_code_without_touching_the_store() -> None:
    """A deployment with no object store still computes ISO U-values."""
    assert surface_film_table("iso_6946") is ISO_6946_TABLE


def test_unpublished_standard_raises_rather_than_falling_back_to_iso(monkeypatch: pytest.MonkeyPatch) -> None:
    """Silently serving ISO numbers under an ASHRAE label would be a wrong answer."""
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "")

    with pytest.raises(SurfaceFilmTableUnavailableError) as error:
        surface_film_table("ashrae")

    assert "iso" not in str(error.value).lower() or "licensed" in str(error.value).lower()


def test_a_different_table_moves_the_resolved_films() -> None:
    """The resolver is table-driven, so a second standard genuinely differs."""
    ashrae = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")

    iso_wall = resolve_surface_resistances("wall", "outdoor_air", ISO_6946_TABLE)
    ashrae_wall = resolve_surface_resistances("wall", "outdoor_air", ashrae)

    assert (iso_wall.rsi_m2k_w, iso_wall.rse_m2k_w) == (0.13, 0.04)
    assert (ashrae_wall.rsi_m2k_w, ashrae_wall.rse_m2k_w) == (0.35, 0.05)
    assert ashrae_wall.standard == "ashrae"
    # Direction is structural, not standard-specific.
    assert iso_wall.heat_flow_direction == ashrae_wall.heat_flow_direction


def test_ventilated_and_ground_rules_apply_to_any_table() -> None:
    ashrae = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")

    ventilated = resolve_surface_resistances("roof", "ventilated", ashrae)
    ground = resolve_surface_resistances("floor", "ground", ashrae)

    assert ventilated.rse_m2k_w == ventilated.rsi_m2k_w == 0.25
    assert ground.rse_m2k_w == 0.0


def test_published_table_is_cached_after_the_first_read(monkeypatch: pytest.MonkeyPatch) -> None:
    """The store must stay off the per-request thermal path."""
    payload = json.dumps(_FIXTURE_PAYLOAD).encode()
    key = "datasets/ashrae-surface-films/1/dataset.json"
    manifest = {
        "generated_at": "2026-07-28T21:00:00Z",
        "datasets": {
            "ashrae-surface-films": {
                "version": "1",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "key": key,
            }
        },
    }
    storage = _FakeStorage(
        {
            MANIFEST_KEY: json.dumps(manifest).encode(),
            key: payload,
        }
    )
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "http://minio.test")
    monkeypatch.setattr(
        SurfaceFilmStore,
        "from_settings",
        classmethod(lambda cls: cls(storage)),
    )

    first = surface_film_table("ashrae")
    second = surface_film_table("ashrae")

    assert first == second
    assert storage.read_count == 2


def test_fixture_values_are_not_the_iso_values() -> None:
    """Guard the guard: the fixtures must differ or every assertion is vacuous."""
    ashrae = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")
    assert isinstance(ashrae, SurfaceFilmTable)
    assert dict(ashrae.rsi_by_direction) != dict(ISO_6946_TABLE.rsi_by_direction)
    assert ashrae.rse_outdoor_air_m2k_w != ISO_6946_TABLE.rse_outdoor_air_m2k_w
