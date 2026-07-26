"""Licensed surface-film table loading.

The values used here are **invented test fixtures**, deliberately not the
real ASHRAE numbers — this repo is public and those are licensed. They only
have to be distinguishable from the ISO 6946 set for the assertions to mean
something.
"""

from __future__ import annotations

import json

import pytest
from botocore.exceptions import ClientError

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
    surface_film_object_key,
    surface_film_table,
)

_FIXTURE_PAYLOAD = {
    "standard": "ashrae",
    "rsi_by_direction": {"upward": 0.11, "horizontal": 0.12, "downward": 0.16},
    "rse_outdoor_air_m2k_w": 0.03,
    "source": "invented test fixture, not ASHRAE",
}


class _FakeStorage:
    """Minimal stand-in for the R2/MinIO client, counting its reads."""

    def __init__(self, objects: dict[str, bytes] | None = None) -> None:
        self.objects = dict(objects or {})
        self.read_count = 0

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str:
        self.objects[object_key] = body
        return "etag"

    def get_object(self, object_key: str) -> bytes:
        self.read_count += 1
        try:
            return self.objects[object_key]
        except KeyError as error:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject") from error


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    reset_surface_film_cache()


def test_object_key_is_namespaced_by_standard() -> None:
    assert surface_film_object_key("ashrae") == "standards/ashrae/surface_films.json"


def test_round_trips_through_the_store() -> None:
    storage = _FakeStorage()
    store = SurfaceFilmStore(storage)
    table = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")

    store.put(table, source="invented test fixture, not ASHRAE")
    restored = store.get("ashrae")

    assert restored == table
    # The citation rides along, so a later reader knows the provenance.
    stored = json.loads(storage.objects[surface_film_object_key("ashrae")])
    assert stored["source"] == "invented test fixture, not ASHRAE"


def test_missing_object_reads_as_unpublished_not_an_error() -> None:
    assert SurfaceFilmStore(_FakeStorage()).get("ashrae") is None


@pytest.mark.parametrize(
    "payload",
    [
        {"rse_outdoor_air_m2k_w": 0.03},
        {"rsi_by_direction": {"upward": 0.11}, "rse_outdoor_air_m2k_w": 0.03},
        {"rsi_by_direction": {"upward": 0, "horizontal": 0.12, "downward": 0.16}, "rse_outdoor_air_m2k_w": 0.03},
        {"rsi_by_direction": {"upward": 0.11, "horizontal": 0.12, "downward": 0.16}},
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
    assert (ashrae_wall.rsi_m2k_w, ashrae_wall.rse_m2k_w) == (0.12, 0.03)
    assert ashrae_wall.standard == "ashrae"
    # Direction is structural, not standard-specific.
    assert iso_wall.heat_flow_direction == ashrae_wall.heat_flow_direction


def test_ventilated_and_ground_rules_apply_to_any_table() -> None:
    ashrae = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")

    ventilated = resolve_surface_resistances("roof", "ventilated", ashrae)
    ground = resolve_surface_resistances("floor", "ground", ashrae)

    assert ventilated.rse_m2k_w == ventilated.rsi_m2k_w == 0.11
    assert ground.rse_m2k_w == 0.0


def test_published_table_is_cached_after_the_first_read(monkeypatch: pytest.MonkeyPatch) -> None:
    """The store must stay off the per-request thermal path."""
    storage = _FakeStorage({surface_film_object_key("ashrae"): json.dumps(_FIXTURE_PAYLOAD).encode()})
    monkeypatch.setattr("features.envelope.surface_film_store.settings.r2_endpoint_url", "http://minio.test")
    monkeypatch.setattr(
        SurfaceFilmStore,
        "from_settings",
        classmethod(lambda cls: cls(storage)),
    )

    first = surface_film_table("ashrae")
    second = surface_film_table("ashrae")

    assert first == second
    assert storage.read_count == 1


def test_fixture_values_are_not_the_iso_values() -> None:
    """Guard the guard: the fixtures must differ or every assertion is vacuous."""
    ashrae = parse_surface_film_payload(_FIXTURE_PAYLOAD, "ashrae")
    assert isinstance(ashrae, SurfaceFilmTable)
    assert dict(ashrae.rsi_by_direction) != dict(ISO_6946_TABLE.rsi_by_direction)
    assert ashrae.rse_outdoor_air_m2k_w != ISO_6946_TABLE.rse_outdoor_air_m2k_w
