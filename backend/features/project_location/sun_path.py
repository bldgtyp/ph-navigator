"""Pure ladybug sun-path + compass builder for the project sun-path service.

`project_location` owns the coordinates the sun path is a pure function of,
so the builder lives here. It imports no consumer; the `model_viewer`
frontend consumes the `/sun-path` endpoint over the wire, and the wire DTOs
are reused from `model_viewer.schemas` (no import cycle — `model_viewer`
does not import `project_location`).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ladybug.compass import Compass
from ladybug.dt import DateTime
from ladybug.location import Location
from ladybug.sunpath import Sunpath
from ladybug_geometry.geometry2d.pointvector import Point2D

from features.model_viewer.schemas.ladybug_geometry import (
    Arc2DSchema,
    Arc3DSchema,
    LineSegment2DSchema,
    Polyline3DSchema,
)
from features.project_location.sun_path_schemas import (
    CompassSchema,
    SunPathAndCompassDTOSchema,
    SunPathSchema,
    SunPositionGridSchema,
)

# Origin-centered, unit radius: the frontend scales the diagram to the model
# bounds, so V2 emits a unit circle (V1 used fixed radius-40 world units).
_UNIT_RADIUS = 1.0
_ORIGIN = Point2D(0, 0)
# Daylight saving off (V1 parity) -- the sun path is a geometric reference,
# not a wall-clock schedule.
_DAYLIGHT_SAVING_PERIOD = None
# Standard meridians sit every 15 degrees of longitude (360 / 24h).
_DEGREES_PER_HOUR = 15.0
# The solar-position grid is 365 days x 24 whole hours (non-leap year, matching
# ladybug's default calendar and the dome's analemma convention).
_DAYS_PER_YEAR = 365
_HOURS_PER_DAY = 24
# Vector components rounded to ~0.006 degrees -- far below visual resolution,
# and it keeps the wire payload compact.
_VECTOR_DECIMALS = 4


def utc_offset_hours(time_zone: str | None, longitude: float) -> float:
    """Standard-time UTC offset (hours) for the location.

    ladybug's `Location.time_zone` is the standard meridian offset; daylight
    saving is modeled separately (and disabled here). For an IANA zone we
    subtract the DST component of a reference instant so the base offset is
    correct in either hemisphere. With no zone set yet we fall back to the
    standard meridian implied by longitude.
    """
    if time_zone is None:
        return round(longitude / _DEGREES_PER_HOUR)
    zone = ZoneInfo(time_zone)
    reference = datetime(2000, 1, 1, 12, tzinfo=zone)
    base_offset = (reference.utcoffset() or timedelta()) - (reference.dst() or timedelta())
    return base_offset.total_seconds() / 3600.0


def build_sun_path(
    *,
    latitude: float,
    longitude: float,
    elevation_m: float,
    true_north_deg: float,
    time_zone: str | None,
) -> SunPathAndCompassDTOSchema:
    """Build the origin-centered, unit-radius sun-path + compass diagram.

    `true_north_deg` (stored convention: CCW from +Y, so 90 = West, 270 =
    East) maps to ladybug's `north_angle` by IDENTITY -- ladybug rotates the
    diagram counter-clockwise by `north_angle`, the same sense as our stored
    value. This is verified by the north-sign fixture in
    `tests/test_project_location_sun_path.py`: with `true_north_deg = 90` the
    compass North tick lands on -X (due West). A wrong sign silently rotates
    the whole sun path, so do not "simplify" the identity mapping away.
    """
    location = Location(
        latitude=latitude,
        longitude=longitude,
        time_zone=utc_offset_hours(time_zone, longitude),
        elevation=elevation_m,
    )
    sun_path = Sunpath.from_location(location, true_north_deg, _DAYLIGHT_SAVING_PERIOD)
    compass = Compass(_UNIT_RADIUS, _ORIGIN, true_north_deg)

    sunpath_dto = SunPathSchema(
        hourly_analemma_polyline3d=[
            Polyline3DSchema(**polyline.to_dict())
            for polyline in sun_path.hourly_analemma_polyline3d(radius=_UNIT_RADIUS)
        ],
        monthly_day_arc3d=[Arc3DSchema(**arc.to_dict()) for arc in sun_path.monthly_day_arc3d(radius=_UNIT_RADIUS)],
    )
    compass_dto = CompassSchema(
        all_boundary_circles=[Arc2DSchema(**circle.to_dict()) for circle in compass.all_boundary_circles],
        major_azimuth_ticks=[LineSegment2DSchema(**tick.to_dict()) for tick in compass.major_azimuth_ticks],
        minor_azimuth_ticks=[LineSegment2DSchema(**tick.to_dict()) for tick in compass.minor_azimuth_ticks],
    )
    return SunPathAndCompassDTOSchema(
        sunpath=sunpath_dto,
        compass=compass_dto,
        sun_positions=_build_sun_position_grid(sun_path),
    )


def _build_sun_position_grid(sun_path: Sunpath) -> SunPositionGridSchema:
    """Hourly solar-position grid from the dome's own ``Sunpath`` instance.

    Same-instance construction is what guarantees the vectors share the
    dome's unit-radius, true-north-baked frame (PRD D-2): ladybug builds the
    analemma vertices from ``sun.position_3d(radius=1)``, which is exactly
    ``sun_vector_reversed`` -- the unit vector emitted here.
    """
    unit_vectors: list[tuple[float, float, float]] = []
    sunrise_sunset: list[tuple[float | None, float | None]] = []
    for day_of_year in range(1, _DAYS_PER_YEAR + 1):
        for hour in range(_HOURS_PER_DAY):
            sun = sun_path.calculate_sun_from_hoy((day_of_year - 1) * _HOURS_PER_DAY + hour)
            vector = sun.sun_vector_reversed
            unit_vectors.append(
                (
                    round(vector.x, _VECTOR_DECIMALS),
                    round(vector.y, _VECTOR_DECIMALS),
                    round(vector.z, _VECTOR_DECIMALS),
                )
            )
        noon = DateTime.from_hoy((day_of_year - 1) * _HOURS_PER_DAY + 12)
        edges = sun_path.calculate_sunrise_sunset(noon.month, noon.day)
        sunrise = edges["sunrise"]
        sunset = edges["sunset"]
        sunrise_sunset.append(
            (
                round(sunrise.float_hour, _VECTOR_DECIMALS) if sunrise is not None else None,
                round(sunset.float_hour, _VECTOR_DECIMALS) if sunset is not None else None,
            )
        )
    return SunPositionGridSchema(
        hours=[float(hour) for hour in range(_HOURS_PER_DAY)],
        days=list(range(1, _DAYS_PER_YEAR + 1)),
        unit_vectors=unit_vectors,
        sunrise_sunset=sunrise_sunset,
    )
