"""Certification proximity math for project climate-source auto-attach and the
manual dataset picker.

Two layers, smallest first: :class:`ClimateProximityVerdict` is the raw math
result (distance, elevation delta, the gate verdict) — the slim shape the
picker roster renders per station. :class:`ClimateSourceProximity` extends it
with the dataset/location identity persisted on an attached source.
"""

from __future__ import annotations

from collections.abc import Iterable
from math import asin, cos, radians, sin, sqrt
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from features.climate.models import ClimateLocationSummary

EARTH_RADIUS_MI = 3958.7613
M_TO_FT = 3.280839895
PHIUS_MAX_DISTANCE_MI = 50.0
PHIUS_MAX_ELEVATION_DELTA_FT = 400.0

PhDatasetProvider = Literal["phius", "phi"]
ProximityStatus = Literal["pass", "warning", "fail"]


class ClimateProximityVerdict(BaseModel):
    """The proximity math result: distance, elevation delta, and the gate verdict."""

    model_config = ConfigDict(extra="forbid")

    distance_mi: float
    elevation_delta_ft: float | None
    status: ProximityStatus
    message: str


class ClimateSourceProximity(ClimateProximityVerdict):
    """A verdict plus the dataset/location identity persisted on an attached source."""

    auto_attached: bool = True
    dataset_id: str
    dataset_provider: str
    dataset_version: str
    location_id: str
    location_name: str
    station_id: str | None = None


def haversine_miles(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    """Great-circle distance in miles."""
    d_lat = radians(lat_b - lat_a)
    d_lon = radians(lon_b - lon_a)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_MI * asin(sqrt(a))


def elevation_delta_ft(site_elevation_m: float | None, station_elevation_m: float | None) -> float | None:
    """Absolute site/station elevation delta in feet, if both elevations are known."""
    if site_elevation_m is None or station_elevation_m is None:
        return None
    return abs(site_elevation_m - station_elevation_m) * M_TO_FT


def phius_proximity_status(distance_mi: float, elevation_delta_ft_: float | None) -> tuple[ProximityStatus, str]:
    """Phius pass/fail against the 50 mi / 400 ft certification rule."""
    if elevation_delta_ft_ is None:
        return "fail", "No Phius set can be verified because station elevation is missing."
    if distance_mi <= PHIUS_MAX_DISTANCE_MI and elevation_delta_ft_ <= PHIUS_MAX_ELEVATION_DELTA_FT:
        return "pass", "Phius climate set is within 50 mi and 400 ft."
    return "fail", "No Phius set within 50 mi / 400 ft — custom set required ($75)."


def phi_proximity_status(distance_mi: float, elevation_delta_ft_: float | None) -> tuple[ProximityStatus, str]:
    """PHI/PHPP representativeness advisory using the same distance/elevation band."""
    if (
        elevation_delta_ft_ is not None
        and distance_mi <= PHIUS_MAX_DISTANCE_MI
        and elevation_delta_ft_ <= PHIUS_MAX_ELEVATION_DELTA_FT
    ):
        return "pass", "PHI climate set is within the 50 mi / 400 ft advisory band."
    return "warning", "Confirm PHI climate-set representativeness with the certifier."


def evaluate_proximity(
    *,
    provider: PhDatasetProvider,
    location: ClimateLocationSummary,
    site_latitude: float,
    site_longitude: float,
    site_elevation_m: float | None,
) -> ClimateProximityVerdict:
    """Compute one station's distance/elevation delta and its gate verdict."""
    if location.latitude is None or location.longitude is None:
        raise ValueError("Climate location is missing coordinates.")
    distance = haversine_miles(site_latitude, site_longitude, location.latitude, location.longitude)
    delta = elevation_delta_ft(site_elevation_m, location.elevation_m)
    status, message = (
        phius_proximity_status(distance, delta) if provider == "phius" else phi_proximity_status(distance, delta)
    )
    return ClimateProximityVerdict(
        distance_mi=round(distance, 1),
        elevation_delta_ft=round(delta, 0) if delta is not None else None,
        status=status,
        message=message,
    )


def build_location_roster(
    *,
    provider: PhDatasetProvider,
    locations: Iterable[ClimateLocationSummary],
    site_latitude: float,
    site_longitude: float,
    site_elevation_m: float | None,
) -> list[tuple[ClimateLocationSummary, ClimateProximityVerdict]]:
    """Pair each located station with its proximity verdict, nearest-first.

    The single per-location loop shared by the picker roster endpoint and
    auto-attach (which builds the roster and takes the first row). Stations
    without coordinates are dropped — proximity is undefined without them.
    """
    roster = [
        (
            location,
            evaluate_proximity(
                provider=provider,
                location=location,
                site_latitude=site_latitude,
                site_longitude=site_longitude,
                site_elevation_m=site_elevation_m,
            ),
        )
        for location in locations
        if location.latitude is not None and location.longitude is not None
    ]
    roster.sort(key=lambda pair: pair[1].distance_mi)
    return roster


def build_proximity_payload(
    *,
    provider: PhDatasetProvider,
    dataset: dict[str, Any],
    location: ClimateLocationSummary,
    site_latitude: float,
    site_longitude: float,
    site_elevation_m: float | None,
    auto_attached: bool = True,
) -> ClimateSourceProximity:
    """Package a station's proximity verdict with its dataset/location identity.

    The persisted source payload. ``auto_attached`` distinguishes the
    address-derived attach (True) from a manual pick in the picker (False).
    """
    verdict = evaluate_proximity(
        provider=provider,
        location=location,
        site_latitude=site_latitude,
        site_longitude=site_longitude,
        site_elevation_m=site_elevation_m,
    )
    return ClimateSourceProximity(
        auto_attached=auto_attached,
        dataset_id=str(dataset["id"]),
        dataset_provider=provider,
        dataset_version=str(dataset["version"]),
        location_id=str(location.id),
        location_name=location.name,
        station_id=location.station_id,
        **verdict.model_dump(),
    )
