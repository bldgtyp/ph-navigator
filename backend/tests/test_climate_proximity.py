"""Certification proximity math for climate auto-attach."""

from __future__ import annotations

import pytest

from features.climate.proximity import (
    elevation_delta_ft,
    haversine_miles,
    phi_proximity_status,
    phius_proximity_status,
)


def test_haversine_matches_known_nyc_to_boston_distance() -> None:
    distance = haversine_miles(40.7128, -74.0060, 42.3601, -71.0589)

    assert distance == pytest.approx(190.2, abs=0.5)


def test_elevation_delta_converts_meters_to_feet() -> None:
    assert elevation_delta_ft(100, 221.92) == pytest.approx(400.0, abs=0.1)


def test_phius_gate_passes_at_50_miles_and_400_feet() -> None:
    status, message = phius_proximity_status(50.0, 400.0)

    assert status == "pass"
    assert "within 50 mi and 400 ft" in message


@pytest.mark.parametrize(
    ("distance_mi", "delta_ft"),
    [(50.1, 100.0), (10.0, 400.1), (50.1, 400.1), (10.0, None)],
)
def test_phius_gate_fails_when_either_limit_is_exceeded(
    distance_mi: float,
    delta_ft: float | None,
) -> None:
    status, message = phius_proximity_status(distance_mi, delta_ft)

    assert status == "fail"
    assert "custom set" in message or "elevation is missing" in message


def test_phi_gate_warns_outside_advisory_band() -> None:
    status, message = phi_proximity_status(50.1, 100.0)

    assert status == "warning"
    assert "Confirm PHI" in message
