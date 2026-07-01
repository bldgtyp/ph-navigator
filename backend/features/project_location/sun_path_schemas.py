"""Wire DTOs for the project sun-path service.

These are the response shape of `GET /projects/{id}/sun-path`, produced by
`sun_path.py` and consumed by the frontend over the wire. They live with
their producer (`project_location`). The low-level ladybug geometry
primitives they are built from are genuinely shared with `model_viewer`'s
face/mesh extraction, so they continue to be imported from
`model_viewer.schemas.ladybug_geometry` rather than duplicated here.
"""

from __future__ import annotations

from pydantic import BaseModel

from features.model_viewer.schemas.ladybug_geometry import (
    Arc2DSchema,
    Arc3DSchema,
    LineSegment2DSchema,
    Polyline3DSchema,
)


class CompassSchema(BaseModel):
    """ladybug.compass.Compass."""

    all_boundary_circles: list[Arc2DSchema] = []
    major_azimuth_ticks: list[LineSegment2DSchema] = []
    minor_azimuth_ticks: list[LineSegment2DSchema] = []


class SunPathSchema(BaseModel):
    """ladybug.sunpath.Sunpath visualization geometry."""

    hourly_analemma_polyline3d: list[Polyline3DSchema] = []
    monthly_day_arc3d: list[Arc3DSchema] = []


class SunPositionGridSchema(BaseModel):
    """Hourly solar positions for the whole year (sun-study scrubbing).

    Built from the SAME ladybug ``Sunpath`` instance as the dome geometry, so
    the vectors live in the identical unit-radius, origin-centered,
    true-north-baked frame as the analemmas/arcs — a grid vector at a whole
    hour coincides exactly with the corresponding analemma vertex. Hours are
    local standard time (DST off) on a 365-day year, matching the dome. The
    frontend may interpolate *between adjacent vectors* for display smoothness
    but derives no new domain values (PRD D-1/D-2).
    """

    # Column labels: whole hours 0.0..23.0 (LST, DST off).
    hours: list[float]
    # Row labels: day-of-year 1..365. Carried explicitly so a coarser day step
    # stays possible without a schema change.
    days: list[int]
    # len == len(days) * len(hours), row-major by day. Unit vectors pointing
    # from the dome origin toward the sun; z < 0 == below horizon (included so
    # hour interpolation stays smooth through sunrise/sunset). Components
    # rounded to 4 decimals (~0.006 deg, far below visual resolution).
    unit_vectors: list[tuple[float, float, float]]
    # Per day: (sunrise, sunset) as decimal hours LST; None/None when the sun
    # never rises/sets (polar edge cases only — never at project latitudes).
    sunrise_sunset: list[tuple[float | None, float | None]]


class SunPathAndCompassDTOSchema(BaseModel):
    """Sun path + compass — the `/sun-path` endpoint response (null when unset)."""

    sunpath: SunPathSchema
    compass: CompassSchema
    sun_positions: SunPositionGridSchema
