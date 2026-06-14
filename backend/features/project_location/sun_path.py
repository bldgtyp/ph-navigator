"""Pure ladybug sun-path + compass builder for the Climate sun-path service.

This is a Climate-domain module: `project_location` is the eventual `climate`
feature home (climate Phase 1, D-CL-2). Consumers import this builder; it
imports no consumer, keeping the `model_viewer -> climate` dependency
one-way.

The sun-path / compass wire DTOs are reused from `model_viewer.schemas` for
now (a deliberate climate Phase 1 trade-off). No import cycle exists because
`model_viewer` does not import `project_location` and the frontend consumes
the `/sun-path` endpoint directly. When `project_location` is formally
renamed to the `climate` module (Phase 3), relocate these ladybug DTOs into
a shared schema home and have `model_viewer` re-export them.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ladybug.compass import Compass
from ladybug.location import Location
from ladybug.sunpath import Sunpath
from ladybug_geometry.geometry2d.pointvector import Point2D

from features.model_viewer.schemas.ladybug import (
    CompassSchema,
    SunPathAndCompassDTOSchema,
    SunPathSchema,
)
from features.model_viewer.schemas.ladybug_geometry import (
    Arc2DSchema,
    Arc3DSchema,
    LineSegment2DSchema,
    Polyline3DSchema,
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
    `tests/test_climate_sun_path.py`: with `true_north_deg = 90` the compass
    North tick lands on -X (due West). A wrong sign silently rotates the
    whole sun path, so do not "simplify" the identity mapping away.
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
    return SunPathAndCompassDTOSchema(sunpath=sunpath_dto, compass=compass_dto)
