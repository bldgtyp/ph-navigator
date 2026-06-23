"""Pydantic mirrors of ladybug sun-path / compass DTOs.

These are the response shape of the project-scoped `GET /projects/{id}/sun-path`
endpoint, produced by `features/project_location/sun_path.py`. They live under
`model_viewer/schemas/` for historical reasons (and reuse the geometry
primitives in `ladybug_geometry.py`, which `model_viewer` also uses for faces);
relocating them to a home owned by the producer is a tracked follow-up — see
planning/features_v1.1/model-viewer-sun-path/STATUS.md.
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
