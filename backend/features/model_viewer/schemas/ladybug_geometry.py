"""Pydantic mirrors of ladybug_geometry primitives used on the viewer wire.

Mesh vertices/faces arrive pre-triangulated from the extraction service —
the frontend never receives quads.
"""

from __future__ import annotations

from pydantic import BaseModel


class Mesh3DSchema(BaseModel):
    """ladybug_geometry.geometry3d.mesh.Mesh3D — triangulated."""

    vertices: list[list[float]]
    faces: list[list[int]]


class PlaneSchema(BaseModel):
    """ladybug_geometry.geometry3d.plane.Plane."""

    n: list[float]
    o: list[float]
    x: list[float]


class Face3DSchema(BaseModel):
    """ladybug_geometry.geometry3d.face.Face3D.

    `mesh` and `area` are patched in by the extraction service (punched +
    triangulated for opaque faces) — they are not part of the upstream
    `Face3D.to_dict()` shape.
    """

    boundary: list[list[float]]
    plane: PlaneSchema
    mesh: Mesh3DSchema | None = None
    area: float | None = None


class LineSegment3DSchema(BaseModel):
    """ladybug_geometry.geometry3d.line.LineSegment3D (point + vector)."""

    p: tuple[float, float, float]
    v: tuple[float, float, float]


class Polyline3DSchema(BaseModel):
    """ladybug_geometry.geometry3d.polyline.Polyline3D."""

    vertices: list[tuple[float, float, float]]


class Arc3DSchema(BaseModel):
    """ladybug_geometry.geometry3d.arc.Arc3D."""

    plane: PlaneSchema
    radius: float
    a1: float
    a2: float


class Arc2DSchema(BaseModel):
    """ladybug_geometry.geometry2d.arc.Arc2D (compass only)."""

    c: tuple[float, float]
    r: float
    a1: float
    a2: float


class LineSegment2DSchema(BaseModel):
    """ladybug_geometry.geometry2d.line.LineSegment2D (compass only)."""

    p: tuple[float, float]
    v: tuple[float, float]
