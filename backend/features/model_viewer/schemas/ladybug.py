"""Pydantic mirrors of ladybug sun-path / compass DTOs.

Phase 2 always serves `sun_path: null` — generation is blocked on the
deferred project-location feature (D-07/OQ-1). The schemas exist now so
the wire shape does not change when that feature lands.
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
    """Sun path + compass, bundled as one nullable wire field."""

    sunpath: SunPathSchema
    compass: CompassSchema
