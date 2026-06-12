"""Pydantic mirrors of honeybee Face / Aperture / Shade objects."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from features.model_viewer.schemas.honeybee_energy import (
    ApertureEnergyPropertiesSchema,
    FaceEnergyPropertiesSchema,
)
from features.model_viewer.schemas.ladybug_geometry import Face3DSchema


class BoundaryConditionSchema(BaseModel):
    """honeybee.boundarycondition — Outdoors | Ground | Adiabatic | Surface."""

    type: str


class FacePropertiesSchema(BaseModel):
    """`face.properties` extension bag (energy only on this wire)."""

    energy: FaceEnergyPropertiesSchema


class AperturePropertiesSchema(BaseModel):
    """`aperture.properties` extension bag (energy only on this wire)."""

    energy: ApertureEnergyPropertiesSchema


class ApertureSchema(BaseModel):
    """honeybee.aperture.Aperture, with mesh/area patched by extraction."""

    identifier: str
    display_name: str
    geometry: Face3DSchema
    face_type: str = "Aperture"
    boundary_condition: BoundaryConditionSchema
    properties: AperturePropertiesSchema


class FaceSchema(BaseModel):
    """honeybee.face.Face with punched, triangulated mesh + construction."""

    type: str
    identifier: str
    face_type: str
    display_name: str
    geometry: Face3DSchema
    boundary_condition: BoundaryConditionSchema
    apertures: list[ApertureSchema] = []
    properties: FacePropertiesSchema


class ShadeSchema(BaseModel):
    """honeybee.shade.Shade; after merging, `geometry.mesh` holds the
    group's single joined Mesh3D (US-VIEW-7 crit. 5)."""

    type: str
    identifier: str
    user_data: dict[Any, Any] | None = None
    display_name: str
    is_detached: bool
    geometry: Face3DSchema


class ShadeGroupSchema(BaseModel):
    """One display_name group of shades, merged server-side to one mesh."""

    shades: list[ShadeSchema] = []
