"""Pure HBJSON → CombinedModelData extraction (US-VIEW-7).

Ported from V1 (`ph-navigator/backend/features/hb_model/services/
model_elements.py`) with the V2 deltas:

- Model units are normalized to Meters before extraction — HBJSON
  exports arrive in Inches/Feet/Meters and the wire is SI everywhere.
- Airflow stays m³/s (V1's pre-Pydantic ×3600 conversion is removed).
- AirBoundary skips are logged AND counted in `load_summary` (Q-VIEW-1).
- Constructions carry all four thermal fields (D-12).

This module is deliberately free of DB/R2 concerns: dict in, DTOs out.
The upload-job / artifact workflow lives in `model_data.py`.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from importlib import metadata
from typing import Any

import structlog
from honeybee.boundarycondition import Ground, Outdoors
from honeybee.model import Model
from ladybug_geometry.geometry3d.mesh import Mesh3D
from ladybug_geometry.geometry3d.pointvector import Point3D
from pydantic import ValidationError

from features.model_viewer.schemas.combined import CombinedModelDataSchema, LoadSummarySchema
from features.model_viewer.schemas.honeybee import FaceSchema, ShadeGroupSchema, ShadeSchema
from features.model_viewer.schemas.honeybee_energy import (
    OpaqueConstructionSchema,
    WindowConstructionSchema,
)
from features.model_viewer.schemas.honeybee_ph import SpaceSchema
from features.model_viewer.schemas.honeybee_phhvac import (
    PhHotWaterSystemSchema,
    PhVentilationSystemSchema,
)
from features.model_viewer.schemas.ladybug_geometry import Mesh3DSchema

log = structlog.get_logger(__name__)

# Tolerance for treating two shade vertices as coincident when joining a
# display_name group into one mesh (V1 parity; model units are Meters by
# the time merging runs, so this is 0.1 µm).
_SHADE_MERGE_TOLERANCE = 1e-7


class ModelParseError(Exception):
    """HBJSON could not be parsed into a honeybee Model — permanent (D-16).

    Permanent means re-requesting cannot succeed: the bytes are invalid
    HBJSON or were exported against a newer honeybee-schema than the
    backend pin. The message names the cause including both versions so
    the file popover tooltip is actionable.
    """


def parse_hb_model(hbjson: dict[str, Any]) -> Model:
    """Parse an HBJSON dict and normalize units to Meters.

    Normalization happens before any extraction so every downstream
    quantity (areas, volumes, mesh coordinates, pipe lengths) is SI
    without per-field conversion.
    """
    declared_version = str(hbjson.get("version", "unknown"))
    backend_pin = metadata.version("honeybee-schema")
    try:
        model = Model.from_dict(hbjson)
    except Exception as exc:
        raise ModelParseError(
            f"Invalid HBJSON: {exc} (file schema version {declared_version}; "
            f"backend supports honeybee-schema {backend_pin})"
        ) from exc
    if model.units != "Meters":
        model.convert_to_units("Meters")
    return model


@dataclass(frozen=True)
class GeometrySummary:
    """Upload-time geometry summary persisted on `project_hbjson_files`.

    Nothing consumes these yet (US-ENV-14 Airtightness is FUTURE); they
    are extracted now so the one upload parse does both jobs (D-13).
    """

    volume_m3: float
    envelope_area_m2: float
    floor_area_m2: float


def extract_geometry_summary(model: Model) -> GeometrySummary:
    """Envelope area = faces with Outdoors/Ground boundary conditions (the
    PH airtightness envelope); floor area = iCFA, i.e. weighted PH-space
    floor area × space quantity."""
    spaces = [space for room in model.rooms for space in room.properties.ph.spaces]
    return GeometrySummary(
        volume_m3=sum(room.volume for room in model.rooms),
        envelope_area_m2=sum(
            face.area for face in model.faces if isinstance(face.boundary_condition, (Outdoors, Ground))
        ),
        floor_area_m2=sum(space.weighted_floor_area * space.quantity for space in spaces),
    )


def extract_model_data(model: Model) -> CombinedModelDataSchema:
    """Build the full viewer payload from a parsed, Meters-normalized model.

    `sun_path` is always None in this phase — generation is blocked on
    the deferred project-location feature (D-07/OQ-1).
    """
    summary = LoadSummarySchema()
    faces = _faces_from_model(model, summary)
    spaces = _spaces_from_model(model, summary)
    shade_groups = _shade_groups_from_model(model)
    summary.faces_extracted = len(faces)
    summary.spaces_extracted = len(spaces)
    summary.shade_groups_extracted = len(shade_groups)
    return CombinedModelDataSchema(
        faces=faces,
        spaces=spaces,
        sun_path=None,
        hot_water_systems=_hot_water_systems_from_model(model, summary),
        ventilation_systems=_ventilation_systems_from_model(model, summary),
        shading_elements=shade_groups,
        load_summary=summary,
    )


def _faces_from_model(model: Model, summary: LoadSummarySchema) -> list[FaceSchema]:
    """Opaque faces with punched, triangulated meshes + D-12 constructions.

    Faces whose construction fails opaque validation (AirBoundaries) are
    skipped, logged, and counted — V1 parity made explicit (Q-VIEW-1).
    """
    face_dtos: list[FaceSchema] = []
    for hb_face in model.faces:
        energy_prop = hb_face.properties.energy
        try:
            construction = OpaqueConstructionSchema(**energy_prop.construction.to_dict())
        except ValidationError:
            log.warning(
                "model_viewer.extraction.face_skipped",
                face=hb_face.display_name,
                construction=energy_prop.construction.display_name,
            )
            summary.air_boundaries_skipped += 1
            continue

        face_dto = FaceSchema(**hb_face.to_dict())
        face_dto.geometry.mesh = Mesh3DSchema(**hb_face.punched_geometry.triangulated_mesh3d.to_dict())
        face_dto.geometry.area = hb_face.punched_geometry.area
        _apply_thermal_fields(construction, energy_prop.construction)
        face_dto.properties.energy.construction = construction

        for aperture_dto, hb_aperture in zip(face_dto.apertures, hb_face.apertures, strict=True):
            aperture_dto.geometry.mesh = Mesh3DSchema(**hb_aperture.geometry.triangulated_mesh3d.to_dict())
            aperture_dto.geometry.area = hb_aperture.geometry.area
            ap_energy_construction = hb_aperture.properties.energy.construction
            try:
                ap_construction = WindowConstructionSchema(**ap_energy_construction.to_dict())
            except ValidationError:
                summary.extraction_warnings.append(
                    f"Aperture '{hb_aperture.display_name}' construction could not be read; "
                    "shown without construction data."
                )
                continue
            _apply_thermal_fields(ap_construction, ap_energy_construction)
            aperture_dto.properties.energy.construction = ap_construction

        face_dtos.append(face_dto)
    return face_dtos


def _apply_thermal_fields(dto: OpaqueConstructionSchema | WindowConstructionSchema, construction: Any) -> None:
    """D-12: ship Factor (air films included) AND Value (films excluded),
    straight from honeybee-energy, no relabeling."""
    dto.u_factor = getattr(construction, "u_factor", 0.0)
    dto.u_value = getattr(construction, "u_value", 0.0)
    dto.r_factor = getattr(construction, "r_factor", 0.0)
    dto.r_value = getattr(construction, "r_value", 0.0)


def _spaces_from_model(model: Model, summary: LoadSummarySchema) -> list[SpaceSchema]:
    """PH-Spaces with volumes, floor segments, and m³/s airflow.

    No unit conversion here — `space.to_dict()` reports airflow in m³/s
    and the wire is SI canonical (US-VIEW-7 crit. 1).
    """
    spaces: list[SpaceSchema] = []
    for room in model.rooms:
        for space in room.properties.ph.spaces:
            try:
                space_dto = SpaceSchema(**space.to_dict(include_mesh=True))
            except ValidationError as exc:
                summary.extraction_warnings.append(f"Space '{space.display_name}' could not be read: {exc.title}")
                continue
            space_dto.net_volume = space.net_volume
            space_dto.floor_area = space.floor_area
            space_dto.weighted_floor_area = space.weighted_floor_area
            space_dto.avg_clear_height = space.avg_clear_height
            space_dto.average_floor_weighting_factor = space.average_floor_weighting_factor
            spaces.append(space_dto)
    return spaces


def _ventilation_systems_from_model(model: Model, summary: LoadSummarySchema) -> list[PhVentilationSystemSchema]:
    """Unique ventilation systems (deduped by display_name across rooms).

    `duct_type` is normalized from list membership (US-VIEW-7 crit. 7):
    real GH exports carry duct_type=1 on exhaust ducts too, and the
    Ventilation lens color-splits on this field — which list the duct
    lives in is the source of truth.
    """
    systems: dict[str, Any] = {}
    for room in model.rooms:
        system = room.properties.ph_hvac.ventilation_system
        if system is not None:
            systems[system.display_name] = system
    dtos: list[PhVentilationSystemSchema] = []
    for system in systems.values():
        try:
            dto = PhVentilationSystemSchema(**system.to_dict())
        except ValidationError as exc:
            summary.extraction_warnings.append(
                f"Ventilation system '{system.display_name}' could not be read: {exc.title}"
            )
            continue
        for duct in dto.supply_ducting:
            duct.duct_type = 1
        for duct in dto.exhaust_ducting:
            duct.duct_type = 2
        dtos.append(dto)
    return dtos


def _hot_water_systems_from_model(model: Model, summary: LoadSummarySchema) -> list[PhHotWaterSystemSchema]:
    """Unique hot-water systems (deduped by display_name across rooms)."""
    systems: dict[str, Any] = {}
    for room in model.rooms:
        system = room.properties.ph_hvac.hot_water_system
        if system is not None:
            systems[system.display_name] = system
    dtos: list[PhHotWaterSystemSchema] = []
    for system in systems.values():
        try:
            dtos.append(PhHotWaterSystemSchema(**system.to_dict(_include_properties=True)))
        except ValidationError as exc:
            summary.extraction_warnings.append(
                f"Hot-water system '{system.display_name}' could not be read: {exc.title}"
            )
    return dtos


def _shade_groups_from_model(model: Model) -> list[ShadeGroupSchema]:
    """Shades grouped by display_name, each group joined into ONE mesh.

    Server-side merging means one draw call per group on the frontend
    regardless of how many source shades the group held (US-VIEW-7
    crit. 5). The join is tolerance-aware so co-located vertices from
    different source shades collapse to a single vertex.
    """
    groups: dict[str, list[Any]] = defaultdict(list)
    for shade in model.shades:
        groups[shade.display_name].append(shade)

    group_dtos: list[ShadeGroupSchema] = []
    for shade_group in groups.values():
        shade_dto = ShadeSchema(**shade_group[0].to_dict())
        face_vertices = (
            vertices for shade in shade_group for vertices in shade.geometry.triangulated_mesh3d.face_vertices
        )
        merged = _join_mesh_faces(face_vertices)
        shade_dto.geometry.mesh = Mesh3DSchema(**merged.to_dict())
        group_dtos.append(ShadeGroupSchema(shades=[shade_dto]))
    return group_dtos


def _join_mesh_faces(mesh_faces: Iterable[tuple[Point3D, ...]]) -> Mesh3D:
    """Join triangle faces into one Mesh3D, merging coincident vertices.

    Tolerance-aware replacement for `Mesh3D.from_face_vertices` (which
    only merges exactly-equal vertices). Vertices are bucketed by rounded
    coordinates so lookup is O(1) per vertex instead of V1's linear scan —
    the 253-shade Hillandale group made the O(n²) original impractical.
    Checking the 27 neighboring buckets preserves the is_equivalent
    semantics for points that round across a bucket edge.
    """
    vertices: list[Point3D] = []
    buckets: dict[tuple[int, int, int], list[int]] = defaultdict(list)
    faces: list[tuple[int, ...]] = []

    def bucket_key(point: Point3D) -> tuple[int, int, int]:
        return (
            round(point.x / _SHADE_MERGE_TOLERANCE),
            round(point.y / _SHADE_MERGE_TOLERANCE),
            round(point.z / _SHADE_MERGE_TOLERANCE),
        )

    def find_or_add(point: Point3D) -> int:
        key = bucket_key(point)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for index in buckets[(key[0] + dx, key[1] + dy, key[2] + dz)]:
                        if point.is_equivalent(vertices[index], _SHADE_MERGE_TOLERANCE):
                            return index
        vertices.append(point)
        buckets[key].append(len(vertices) - 1)
        return len(vertices) - 1

    for mesh_face in mesh_faces:
        faces.append(tuple(find_or_add(point) for point in mesh_face))
    return Mesh3D(tuple(vertices), tuple(faces))
