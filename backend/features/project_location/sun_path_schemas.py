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


class SunPathAndCompassDTOSchema(BaseModel):
    """Sun path + compass — the `/sun-path` endpoint response (null when unset)."""

    sunpath: SunPathSchema
    compass: CompassSchema
