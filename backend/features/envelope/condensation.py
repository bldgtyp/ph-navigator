"""Pure ISO 13788 monthly condensation-risk screening for assemblies.

The calculation has no storage or network dependencies. Callers supply the
versioned assembly/material snapshot, normalized climate record, surface-film
table, and assumptions. This keeps the physics testable and prevents the
storage-layer import cycle that the thermal boundary-condition work exposed.

Layer sets are deliberately explicit:

* every physical layer contributes vapour resistance;
* membrane layers contribute zero thermal resistance and require direct ``sd``;
* ordinary layers contribute thermal resistance and resolve ``sd`` from the
  material's direct value, then ``mu * thickness``, then the ISO 13788 air-layer
  convention.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from itertools import product
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.climate.record import ClimateRecord
from features.envelope.boundary_conditions import (
    ISO_13788_SURFACE_CHECK_RSI,
    SurfaceFilmTable,
    SurfaceResistances,
    resolve_surface_resistances,
)
from features.envelope.membranes import assigned_materials, is_membrane_layer
from features.envelope.thermal import thermal_issues
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    CondensationSettings,
    ProjectMaterial,
)

CondensationState = Literal["screened", "blocked", "not_screened"]
CondensationVerdict = Literal["d1", "d2", "d3", "d4"]
CriterionCode = Literal["surface_condensation", "mold_growth", "frsi", "interstitial"]
CondensationStatusFlag = Literal[
    "missing_material",
    "missing_conductivity",
    "invalid_geometry",
    "broken_material_reference",
    "no_thermal_layers",
    "missing_vapor_data",
    "missing_membrane_sd",
    "missing_climate_source",
    "zero_total_sd",
    "invalid_climate_data",
    "invalid_settings",
    "ground_not_screened",
    "unconditioned_space_not_screened",
    "path_limit_fallback",
]
CondensationCaveatCode = Literal[
    "high_storage_masonry",
    "multiple_condensing_interfaces",
    "climate_rh_clamped",
]
CondensationDiagnosticCode = Literal[
    "ventilated_stack_convention",
    "path_limit_fallback",
    "roof_temperature_offset",
    "iso_6946_exterior_rule_with_non_iso_films",
]

MONTH_NAMES: tuple[str, ...] = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
MONTH_DAYS: tuple[int, ...] = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
AIR_CATEGORIES = frozenset(
    {
        "air_horizontal_heat_flow",
        "air_upward_heat_flow",
        "air_downward_heat_flow",
    }
)

# ISO 13788:2012 Annex E / PHI workbook method parameters.
STILL_AIR_VAPOR_PERMEABILITY_KG_M_S_PA = 2.0e-10
AIR_LAYER_SD_M = 0.01
PATH_ENUMERATION_LIMIT = 64
_MASS_TOLERANCE_G_M2 = 1.0e-6
_PRESSURE_TOLERANCE_PA = 1.0e-7
_SD_TOLERANCE_M = 1.0e-12


class _ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CondensationIssue(_ContractModel):
    code: CondensationStatusFlag
    message: str
    assembly_id: str
    assembly_name: str
    layer_id: str | None = None
    layer_order: int | None = None
    segment_id: str | None = None
    segment_order: int | None = None
    project_material_id: str | None = None
    project_material_name: str | None = None


class CondensationStatus(_ContractModel):
    state: CondensationState
    is_complete: bool
    flags: list[CondensationStatusFlag] = Field(default_factory=list)


class CondensationCaveat(_ContractModel):
    code: CondensationCaveatCode
    material_ids: list[str] = Field(default_factory=list)


class CondensationDiagnostic(_ContractModel):
    code: CondensationDiagnosticCode
    layer_id: str | None = None


class CondensationCriterion(_ContractModel):
    code: CriterionCode
    is_clear: bool
    worst_month: int
    worst_month_name: str
    margin: float | None = None


class CondensationCriteria(_ContractModel):
    surface_condensation: CondensationCriterion
    mold_growth: CondensationCriterion
    frsi: CondensationCriterion
    interstitial: CondensationCriterion


class CondensationNodeProfile(_ContractModel):
    node_index: int
    outside_layer_id: str | None
    cumulative_thickness_m: float
    cumulative_sd_m: float
    temperature_c: float
    saturation_pressure_pa: float
    vapor_pressure_pa: float
    relative_humidity: float
    is_condensing: bool


class CondensationInterfaceMonth(_ContractModel):
    node_index: int
    outside_layer_id: str
    inside_layer_id: str
    condensation_rate_kg_m2_s: float
    moisture_change_g_m2: float
    accumulated_moisture_g_m2: float


class CondensationMonth(_ContractModel):
    month: int
    month_name: str
    exterior_air_temp_c: float
    exterior_profile_temp_c: float
    exterior_rh: float
    interior_temp_c: float
    interior_rh: float
    exterior_vapor_pressure_pa: float
    interior_vapor_pressure_pa: float
    interior_surface_temp_c: float
    dewpoint_threshold_c: float
    mold_threshold_c: float
    frsi: float
    frsi_min: float
    surface_condensation_clear: bool
    mold_growth_clear: bool
    frsi_clear: bool
    condensing_interface_count: int
    moisture_change_g_m2: float
    accumulated_moisture_g_m2: float
    nodes: list[CondensationNodeProfile]
    interfaces: list[CondensationInterfaceMonth]


class CondensationInterfaceSummary(_ContractModel):
    node_index: int
    outside_layer_id: str
    inside_layer_id: str
    peak_accumulated_moisture_g_m2: float
    condensing_months: list[int]


class CondensationPathSummary(_ContractModel):
    path_id: str
    label: str
    area_fraction: float
    verdict: CondensationVerdict
    peak_accumulated_moisture_g_m2: float
    final_accumulated_moisture_g_m2: float
    interface_count: int


class CondensationResult(_ContractModel):
    """Full small read model used by the chip and all future modal tiers."""

    status: CondensationStatus
    input_hash: str
    issues: list[CondensationIssue] = Field(default_factory=list)
    caveats: list[CondensationCaveat] = Field(default_factory=list)
    diagnostics: list[CondensationDiagnostic] = Field(default_factory=list)
    rsi_m2k_w: float
    rse_m2k_w: float
    thermal_standard: str
    settings: CondensationSettings
    roof_temperature_offset_k: float
    path_count: int
    paths_evaluated: int
    worst_path_id: str | None = None
    path_summaries: list[CondensationPathSummary] = Field(default_factory=list)
    verdict: CondensationVerdict | None = None
    criteria: CondensationCriteria | None = None
    interface_count: int = 0
    interfaces: list[CondensationInterfaceSummary] = Field(default_factory=list)
    start_month: int | None = None
    start_month_name: str | None = None
    peak_accumulated_moisture_g_m2: float | None = None
    final_accumulated_moisture_g_m2: float | None = None
    monthly: list[CondensationMonth] = Field(default_factory=list)


class CondensationClimateSource(_ContractModel):
    id: UUID
    kind: Literal["custom", "phi", "phius"]
    label: str | None = None


class AssemblyCondensationResponse(CondensationResult):
    """Route read model: pure result plus document and climate-source identity."""

    project_id: UUID
    version_id: UUID
    source: Literal["version", "draft"]
    assembly_id: str
    climate_source: CondensationClimateSource | None = None


@dataclass(frozen=True)
class _PathLayer:
    layer: AssemblyLayer
    segment: AssemblySegment
    material: ProjectMaterial
    width_fraction: float
    r_m2k_w: float
    sd_m: float


@dataclass(frozen=True)
class _PathDefinition:
    path_id: str
    label: str
    area_fraction: float
    layers: tuple[_PathLayer, ...]
    total_layer_r_m2k_w: float
    cumulative_layer_r_m2k_w: tuple[float, ...]
    cumulative_sd_m: tuple[float, ...]
    cumulative_thickness_m: tuple[float, ...]


@dataclass(frozen=True)
class _BoundaryMonth:
    month_index: int
    exterior_air_temp_c: float
    exterior_profile_temp_c: float
    exterior_rh: float
    interior_temp_c: float
    interior_rh: float
    exterior_vapor_pressure_pa: float
    interior_vapor_pressure_pa: float


@dataclass(frozen=True)
class _Cycle:
    start_month_index: int
    months: tuple[CondensationMonth, ...]
    peak_mass_g_m2: float
    final_mass_g_m2: float
    closes: bool
    interface_summaries: tuple[CondensationInterfaceSummary, ...]


@dataclass(frozen=True)
class _PathRun:
    definition: _PathDefinition
    cycle: _Cycle
    verdict: CondensationVerdict
    criteria: CondensationCriteria


def saturation_pressure_pa(temperature_c: float) -> float:
    """ISO 13788 saturation vapour pressure over water or ice."""

    if temperature_c >= 0:
        return 610.5 * math.exp(17.269 * temperature_c / (237.3 + temperature_c))
    return 610.5 * math.exp(21.875 * temperature_c / (265.5 + temperature_c))


def saturation_temperature_c(pressure_pa: float) -> float:
    """Inverse of :func:`saturation_pressure_pa` for positive pressure."""

    if pressure_pa <= 0 or not math.isfinite(pressure_pa):
        raise ValueError("saturation pressure must be a finite positive number")
    logarithm = math.log(pressure_pa / 610.5)
    if pressure_pa >= 610.5:
        return 237.3 * logarithm / (17.269 - logarithm)
    return 265.5 * logarithm / (21.875 - logarithm)


def condensation_input_hash(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
    climate_record: ClimateRecord | None,
    film_table: SurfaceFilmTable,
    settings: CondensationSettings,
    climate_source_identity: Mapping[str, str | None] | None = None,
) -> str:
    """Hash every pure input that can change a condensation result."""

    referenced_ids = {
        segment.project_material_id
        for layer in assembly.layers
        for segment in layer.segments
        if segment.project_material_id is not None
    }
    referenced_materials = {
        material_id: (
            materials_by_id[material_id].model_dump(mode="json")
            if material_id in materials_by_id
            else {"id": material_id, "missing": True}
        )
        for material_id in sorted(referenced_ids)
    }
    payload = {
        "assembly": assembly.model_dump(mode="json"),
        "materials": referenced_materials,
        "climate": climate_record.model_dump(mode="json") if climate_record is not None else None,
        "climate_source": dict(climate_source_identity) if climate_source_identity is not None else None,
        "film_table": {
            "standard": film_table.standard,
            "rsi_by_direction": dict(film_table.rsi_by_direction),
            "rse_outdoor_air_m2k_w": film_table.rse_outdoor_air_m2k_w,
        },
        "settings": settings.model_dump(mode="json"),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def calculate_assembly_condensation(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
    climate_record: ClimateRecord | None,
    film_table: SurfaceFilmTable,
    settings: CondensationSettings | None = None,
    *,
    climate_source_identity: Mapping[str, str | None] | None = None,
) -> CondensationResult:
    """Calculate the worst bounded 1-D path through an assembly.

    ``ground`` and ``unconditioned_space`` are intentionally returned as
    not-screened states. The latter has no defensible exterior temperature
    until an adjacent-space temperature factor exists.
    """

    resolved_settings = settings or CondensationSettings()
    films = resolve_surface_resistances(assembly.type, assembly.exterior_condition, film_table)
    input_hash = condensation_input_hash(
        assembly,
        materials_by_id,
        climate_record,
        film_table,
        resolved_settings,
        climate_source_identity,
    )
    diagnostics = _diagnostics(assembly, materials_by_id, film_table)
    caveats = _material_caveats(assembly, materials_by_id)
    roof_offset = -2.0 if assembly.type == "roof" else 0.0

    if assembly.exterior_condition in {"ground", "unconditioned_space"}:
        flag: CondensationStatusFlag = (
            "ground_not_screened" if assembly.exterior_condition == "ground" else "unconditioned_space_not_screened"
        )
        return _empty_result(
            state="not_screened",
            flags=[flag],
            input_hash=input_hash,
            films=films,
            roof_offset=roof_offset,
            settings=resolved_settings,
            diagnostics=diagnostics,
            caveats=caveats,
        )

    issues = _condensation_issues(assembly, materials_by_id, climate_record, resolved_settings)
    path_definitions: list[_PathDefinition] = []
    path_count = 0
    used_fallback = False
    if not issues:
        path_definitions, path_count, used_fallback = _path_definitions(assembly, materials_by_id)
        if any(definition.cumulative_sd_m[-1] <= _SD_TOLERANCE_M for definition in path_definitions):
            issues.append(
                CondensationIssue(
                    code="zero_total_sd",
                    message=_issue_message("zero_total_sd"),
                    assembly_id=assembly.id,
                    assembly_name=assembly.name,
                )
            )
    blocking_flags = sorted({issue.code for issue in issues})
    if blocking_flags:
        return _empty_result(
            state="blocked",
            flags=blocking_flags,
            input_hash=input_hash,
            films=films,
            roof_offset=roof_offset,
            settings=resolved_settings,
            diagnostics=diagnostics,
            caveats=caveats,
            issues=issues,
        )

    assert climate_record is not None
    flags: list[CondensationStatusFlag] = []
    if used_fallback:
        flags.append("path_limit_fallback")
        diagnostics.append(CondensationDiagnostic(code="path_limit_fallback"))

    boundary_months, climate_was_clamped = _boundary_months(
        climate_record,
        resolved_settings,
        roof_offset,
    )
    if climate_was_clamped:
        caveats.append(CondensationCaveat(code="climate_rh_clamped"))

    path_runs = [
        _calculate_path(definition, boundary_months, films.rsi_m2k_w, films.rse_m2k_w, resolved_settings)
        for definition in path_definitions
    ]
    worst = max(
        path_runs,
        key=lambda run: (
            _verdict_severity(run.verdict),
            run.cycle.peak_mass_g_m2,
            run.definition.path_id,
        ),
    )
    max_interface_count = max(
        (max(month.condensing_interface_count for month in run.cycle.months) for run in path_runs),
        default=0,
    )
    if max_interface_count >= 2:
        caveats.append(CondensationCaveat(code="multiple_condensing_interfaces"))

    summaries = [
        CondensationPathSummary(
            path_id=run.definition.path_id,
            label=run.definition.label,
            area_fraction=run.definition.area_fraction,
            verdict=run.verdict,
            peak_accumulated_moisture_g_m2=run.cycle.peak_mass_g_m2,
            final_accumulated_moisture_g_m2=run.cycle.final_mass_g_m2,
            interface_count=len(run.cycle.interface_summaries),
        )
        for run in sorted(path_runs, key=lambda run: run.definition.path_id)
    ]
    return CondensationResult(
        status=CondensationStatus(state="screened", is_complete=True, flags=flags),
        input_hash=input_hash,
        issues=[],
        caveats=_dedupe_caveats(caveats),
        diagnostics=_dedupe_diagnostics(diagnostics),
        rsi_m2k_w=films.rsi_m2k_w,
        rse_m2k_w=films.rse_m2k_w,
        thermal_standard=films.standard,
        settings=resolved_settings,
        roof_temperature_offset_k=roof_offset,
        path_count=path_count,
        paths_evaluated=len(path_runs),
        worst_path_id=worst.definition.path_id,
        path_summaries=summaries,
        verdict=worst.verdict,
        criteria=worst.criteria,
        interface_count=len(worst.cycle.interface_summaries),
        interfaces=list(worst.cycle.interface_summaries),
        start_month=worst.cycle.start_month_index + 1,
        start_month_name=MONTH_NAMES[worst.cycle.start_month_index],
        peak_accumulated_moisture_g_m2=worst.cycle.peak_mass_g_m2,
        final_accumulated_moisture_g_m2=worst.cycle.final_mass_g_m2,
        monthly=list(worst.cycle.months),
    )


def _empty_result(
    *,
    state: Literal["blocked", "not_screened"],
    flags: list[CondensationStatusFlag],
    input_hash: str,
    films: SurfaceResistances,
    roof_offset: float,
    settings: CondensationSettings,
    diagnostics: list[CondensationDiagnostic],
    caveats: list[CondensationCaveat],
    issues: list[CondensationIssue] | None = None,
) -> CondensationResult:
    return CondensationResult(
        status=CondensationStatus(state=state, is_complete=False, flags=flags),
        input_hash=input_hash,
        issues=issues or [],
        caveats=_dedupe_caveats(caveats),
        diagnostics=_dedupe_diagnostics(diagnostics),
        rsi_m2k_w=films.rsi_m2k_w,
        rse_m2k_w=films.rse_m2k_w,
        thermal_standard=films.standard,
        settings=settings,
        roof_temperature_offset_k=roof_offset,
        path_count=0,
        paths_evaluated=0,
    )


def _condensation_issues(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
    climate_record: ClimateRecord | None,
    settings: CondensationSettings,
) -> list[CondensationIssue]:
    issues: list[CondensationIssue] = []
    for issue in thermal_issues(assembly, dict(materials_by_id)):
        issues.append(
            CondensationIssue(
                code=issue.code,
                message=_issue_message(issue.code),
                assembly_id=issue.assembly_id,
                assembly_name=issue.assembly_name,
                layer_id=issue.layer_id,
                layer_order=issue.layer_order,
                segment_id=issue.segment_id,
                segment_order=issue.segment_order,
            )
        )

    for layer_index, layer in enumerate(assembly.layers):
        membrane = is_membrane_layer(layer, materials_by_id)
        for segment_index, segment in enumerate(layer.segments):
            material = materials_by_id.get(segment.project_material_id or "")
            if material is None:
                continue
            if _resolved_sd_m(layer, material, membrane) is not None:
                continue
            code: CondensationStatusFlag = "missing_membrane_sd" if membrane else "missing_vapor_data"
            issues.append(
                CondensationIssue(
                    code=code,
                    message=_issue_message(code),
                    assembly_id=assembly.id,
                    assembly_name=assembly.name,
                    layer_id=layer.id,
                    layer_order=layer_index,
                    segment_id=segment.id,
                    segment_order=segment_index,
                    project_material_id=material.id,
                    project_material_name=material.name,
                )
            )

    settings_message = _invalid_settings_message(settings)
    if settings_message is not None:
        issues.append(
            CondensationIssue(
                code="invalid_settings",
                message=settings_message,
                assembly_id=assembly.id,
                assembly_name=assembly.name,
            )
        )
    if climate_record is None:
        issues.append(
            CondensationIssue(
                code="missing_climate_source",
                message=_issue_message("missing_climate_source"),
                assembly_id=assembly.id,
                assembly_name=assembly.name,
            )
        )
    elif not _climate_values_are_finite(climate_record):
        issues.append(
            CondensationIssue(
                code="invalid_climate_data",
                message=_issue_message("invalid_climate_data"),
                assembly_id=assembly.id,
                assembly_name=assembly.name,
            )
        )

    return _dedupe_issues(issues)


def _issue_message(code: CondensationStatusFlag) -> str:
    return {
        "missing_material": "One or more segments do not have a material assignment.",
        "missing_conductivity": "One or more non-membrane materials need conductivity.",
        "invalid_geometry": "Layer thickness or segment geometry is invalid.",
        "broken_material_reference": "One or more segments reference a missing project material.",
        "no_thermal_layers": "Every layer is a membrane, so no temperature profile can be calculated.",
        "missing_vapor_data": "One or more materials need a direct sd or vapor resistance value.",
        "missing_membrane_sd": "A membrane requires a direct sd value.",
        "missing_climate_source": "Attach a PHI, Phius, or custom climate record to screen this assembly.",
        "zero_total_sd": "The selected material path has no total vapor resistance.",
        "invalid_climate_data": "Monthly climate temperatures must be finite.",
        "invalid_settings": "The selected interior climate model is missing a required setpoint.",
        "ground_not_screened": "Ground-contact assemblies are outside this ISO 13788 screen.",
        "unconditioned_space_not_screened": "Adjacent-space temperature is not modelled.",
        "path_limit_fallback": "The assembly exceeded the path cap; the widest-segment path was used.",
    }[code]


def _invalid_settings_message(settings: CondensationSettings) -> str | None:
    if settings.interior_climate_model == "iso13788_humidity_class" and settings.setpoint_temp_c is None:
        return "Humidity-class climate needs an interior temperature setpoint."
    if settings.interior_climate_model == "fixed_setpoint" and (
        settings.setpoint_temp_c is None or settings.setpoint_rh is None
    ):
        return "Fixed-setpoint climate needs both temperature and relative humidity."
    return None


def _climate_values_are_finite(climate_record: ClimateRecord) -> bool:
    temperatures = climate_record.climate.monthly_temps
    return all(math.isfinite(value) for value in [*temperatures.air_c, *temperatures.dewpoint_c])


def _resolved_sd_m(
    layer: AssemblyLayer,
    material: ProjectMaterial,
    membrane: bool,
) -> float | None:
    if material.vapor_sd_equivalent_m is not None:
        return material.vapor_sd_equivalent_m
    if membrane:
        return None
    if material.vapor_diffusion_resistance_mu is not None:
        return material.vapor_diffusion_resistance_mu * layer.thickness_mm / 1000.0
    if _is_air_material(material):
        return AIR_LAYER_SD_M
    return None


def _path_definitions(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> tuple[list[_PathDefinition], int, bool]:
    ordered_layers = assembly.layers_outside_to_inside()
    cumulative_thickness = [0.0]
    for layer in ordered_layers:
        cumulative_thickness.append(cumulative_thickness[-1] + layer.thickness_mm / 1000.0)
    cumulative_thickness_m = tuple(cumulative_thickness)

    layer_options: list[tuple[_PathLayer, ...]] = []
    for layer in ordered_layers:
        membrane = is_membrane_layer(layer, materials_by_id)
        total_width = sum(segment.width_mm for segment in layer.segments)
        options: list[_PathLayer] = []
        for segment in sorted(layer.segments, key=lambda item: item.order):
            material = materials_by_id[segment.project_material_id or ""]
            sd_m = _resolved_sd_m(layer, material, membrane)
            if sd_m is None:
                raise RuntimeError("path construction reached unresolved vapor data")
            options.append(
                _PathLayer(
                    layer=layer,
                    segment=segment,
                    material=material,
                    width_fraction=segment.width_mm / total_width,
                    r_m2k_w=(0.0 if membrane else (layer.thickness_mm / 1000.0) / (material.conductivity_w_mk or 0.0)),
                    sd_m=sd_m,
                )
            )
        layer_options.append(tuple(options))

    path_count = math.prod(len(options) for options in layer_options)
    used_fallback = path_count > PATH_ENUMERATION_LIMIT
    combinations: Iterable[tuple[_PathLayer, ...]]
    if used_fallback:
        combinations = (tuple(max(options, key=lambda option: option.segment.width_mm) for options in layer_options),)
    else:
        combinations = product(*layer_options)

    definitions: list[_PathDefinition] = []
    for combination in combinations:
        cumulative_r = [0.0]
        cumulative_sd = [0.0]
        for option in combination:
            cumulative_r.append(cumulative_r[-1] + option.r_m2k_w)
            cumulative_sd.append(cumulative_sd[-1] + option.sd_m)
        path_id = "|".join(option.segment.id for option in combination)
        definitions.append(
            _PathDefinition(
                path_id=path_id,
                label=" · ".join(f"{option.layer.order + 1}: {option.material.name}" for option in combination),
                area_fraction=math.prod(option.width_fraction for option in combination),
                layers=combination,
                total_layer_r_m2k_w=cumulative_r[-1],
                cumulative_layer_r_m2k_w=tuple(cumulative_r),
                cumulative_sd_m=tuple(cumulative_sd),
                cumulative_thickness_m=cumulative_thickness_m,
            )
        )
    return definitions, path_count, used_fallback


def _boundary_months(
    climate_record: ClimateRecord,
    settings: CondensationSettings,
    roof_offset_k: float,
) -> tuple[tuple[_BoundaryMonth, ...], bool]:
    temperatures = climate_record.climate.monthly_temps
    months: list[_BoundaryMonth] = []
    clamped = False
    for month_index, (exterior_temp_c, dewpoint_c) in enumerate(
        zip(temperatures.air_c, temperatures.dewpoint_c, strict=True)
    ):
        bounded_dewpoint_c = dewpoint_c
        if dewpoint_c > exterior_temp_c:
            bounded_dewpoint_c = exterior_temp_c
            clamped = True
        exterior_psat = saturation_pressure_pa(exterior_temp_c)
        exterior_pressure = saturation_pressure_pa(bounded_dewpoint_c)
        exterior_rh = min(1.0, exterior_pressure / exterior_psat)
        interior_temp_c, interior_pressure = _interior_conditions(
            settings,
            exterior_temp_c,
            exterior_pressure,
        )
        interior_rh = interior_pressure / saturation_pressure_pa(interior_temp_c)
        months.append(
            _BoundaryMonth(
                month_index=month_index,
                exterior_air_temp_c=exterior_temp_c,
                exterior_profile_temp_c=exterior_temp_c + roof_offset_k,
                exterior_rh=exterior_rh,
                interior_temp_c=interior_temp_c,
                interior_rh=interior_rh,
                exterior_vapor_pressure_pa=exterior_pressure,
                interior_vapor_pressure_pa=interior_pressure,
            )
        )
    return tuple(months), clamped


def _interior_conditions(
    settings: CondensationSettings,
    exterior_temp_c: float,
    exterior_pressure_pa: float,
) -> tuple[float, float]:
    if settings.interior_climate_model == "iso13788_continental":
        interior_temp_c = _clamp(20.0 + 0.5 * (exterior_temp_c - 10.0), 20.0, 25.0)
        normal_rh = _clamp(0.45 + 0.01 * exterior_temp_c, 0.35, 0.65)
        offset = {"low": -0.05, "normal": 0.0, "high": 0.05}[settings.occupancy_class]
        interior_rh = normal_rh + offset
        return interior_temp_c, interior_rh * saturation_pressure_pa(interior_temp_c)
    if settings.interior_climate_model == "iso13788_humidity_class":
        interior_temp_c = settings.setpoint_temp_c
        if interior_temp_c is None:
            raise RuntimeError("humidity-class settings were not validated")
        cold_delta, warm_delta = {
            1: (270.0, 100.0),
            2: (640.0, 100.0),
            3: (810.0, 100.0),
            4: (1080.0, 100.0),
            5: (1360.0, 200.0),
        }[settings.humidity_class]
        fraction = _clamp(exterior_temp_c / 20.0, 0.0, 1.0)
        delta_pressure = cold_delta + fraction * (warm_delta - cold_delta)
        return interior_temp_c, exterior_pressure_pa + delta_pressure
    interior_temp_c = settings.setpoint_temp_c
    interior_rh = settings.setpoint_rh
    if interior_temp_c is None or interior_rh is None:
        raise RuntimeError("fixed-setpoint settings were not validated")
    return interior_temp_c, interior_rh * saturation_pressure_pa(interior_temp_c)


def _calculate_path(
    definition: _PathDefinition,
    boundary_months: tuple[_BoundaryMonth, ...],
    rsi_m2k_w: float,
    rse_m2k_w: float,
    settings: CondensationSettings,
) -> _PathRun:
    cycles = [
        _simulate_cycle(
            definition,
            boundary_months,
            rsi_m2k_w,
            rse_m2k_w,
            start_month_index,
        )
        for start_month_index in range(12)
    ]
    closing_cycles = [cycle for cycle in cycles if cycle.closes]
    if closing_cycles:
        cycle = min(
            closing_cycles,
            key=lambda candidate: (
                candidate.start_month_index != _canonical_start_month(candidate.months),
                candidate.start_month_index,
            ),
        )
    else:
        provisional = min(cycles, key=lambda candidate: (candidate.final_mass_g_m2, candidate.start_month_index))
        canonical_start = _canonical_start_month(provisional.months)
        # A non-closing cycle has no periodic steady-state start: re-running
        # from the month after the minimum can simply move that minimum again
        # (constant year-round accumulation is the degenerate example). Keep
        # the deterministic least-final-mass candidate and attach the derived
        # canonical *display* month to it instead of chasing a nonexistent
        # fixed point.
        cycle = replace(provisional, start_month_index=canonical_start)

    verdict = _verdict(cycle, settings.ma_limit_g_m2)
    criteria = _criteria(cycle, verdict, settings.ma_limit_g_m2)
    return _PathRun(
        definition=definition,
        cycle=cycle,
        verdict=verdict,
        criteria=criteria,
    )


def _simulate_cycle(
    definition: _PathDefinition,
    boundary_months: tuple[_BoundaryMonth, ...],
    rsi_m2k_w: float,
    rse_m2k_w: float,
    start_month_index: int,
) -> _Cycle:
    accumulated_by_node: dict[int, float] = {}
    calendar_months: list[CondensationMonth | None] = [None] * 12
    interface_peak: dict[int, float] = {}
    condensing_months: dict[int, set[int]] = {}

    for offset in range(12):
        month_index = (start_month_index + offset) % 12
        month, accumulated_by_node = _calculate_month(
            definition,
            boundary_months[month_index],
            rsi_m2k_w,
            rse_m2k_w,
            accumulated_by_node,
        )
        calendar_months[month_index] = month
        for interface in month.interfaces:
            interface_peak[interface.node_index] = max(
                interface_peak.get(interface.node_index, 0.0),
                interface.accumulated_moisture_g_m2,
            )
            if interface.condensation_rate_kg_m2_s > 0:
                condensing_months.setdefault(interface.node_index, set()).add(month.month)

    months = tuple(month for month in calendar_months if month is not None)
    final_mass = sum(accumulated_by_node.values())
    peak_mass = max((month.accumulated_moisture_g_m2 for month in months), default=0.0)
    summaries: list[CondensationInterfaceSummary] = []
    for node_index in sorted(interface_peak):
        summaries.append(
            CondensationInterfaceSummary(
                node_index=node_index,
                outside_layer_id=definition.layers[node_index - 1].layer.id,
                inside_layer_id=definition.layers[node_index].layer.id,
                peak_accumulated_moisture_g_m2=interface_peak[node_index],
                condensing_months=sorted(condensing_months.get(node_index, set())),
            )
        )
    return _Cycle(
        start_month_index=start_month_index,
        months=months,
        peak_mass_g_m2=peak_mass,
        final_mass_g_m2=final_mass,
        closes=final_mass <= _MASS_TOLERANCE_G_M2,
        interface_summaries=tuple(summaries),
    )


def _calculate_month(
    definition: _PathDefinition,
    boundary: _BoundaryMonth,
    rsi_m2k_w: float,
    rse_m2k_w: float,
    accumulated_by_node: Mapping[int, float],
) -> tuple[CondensationMonth, dict[int, float]]:
    layers = definition.layers
    total_layer_r = definition.total_layer_r_m2k_w
    total_r = rse_m2k_w + total_layer_r + rsi_m2k_w
    temperature_delta = boundary.interior_temp_c - boundary.exterior_profile_temp_c

    temperatures = [
        boundary.exterior_profile_temp_c + (rse_m2k_w + cumulative_layer_r) / total_r * temperature_delta
        for cumulative_layer_r in definition.cumulative_layer_r_m2k_w
    ]
    cumulative_sd = definition.cumulative_sd_m
    cumulative_thickness = definition.cumulative_thickness_m
    saturation_pressures = [saturation_pressure_pa(temperature) for temperature in temperatures]
    interior_node = len(layers)
    active = {
        node_index
        for node_index, mass in accumulated_by_node.items()
        if 0 < node_index < interior_node and mass > _MASS_TOLERANCE_G_M2
    }
    while True:
        actual_pressures = _piecewise_pressures(
            cumulative_sd,
            saturation_pressures,
            active,
            boundary.exterior_vapor_pressure_pa,
            boundary.interior_vapor_pressure_pa,
        )
        violations = [
            node_index
            for node_index in range(1, interior_node)
            if node_index not in active
            and actual_pressures[node_index] > saturation_pressures[node_index] + _PRESSURE_TOLERANCE_PA
        ]
        if not violations:
            break
        active.add(
            max(
                violations,
                key=lambda node_index: actual_pressures[node_index] - saturation_pressures[node_index],
            )
        )

    anchors = [0, *sorted(active), interior_node]
    seconds = MONTH_DAYS[boundary.month_index] * 24 * 60 * 60
    next_accumulated: dict[int, float] = {}
    interface_months: list[CondensationInterfaceMonth] = []
    positive_condensation_nodes: set[int] = set()
    total_change_g_m2 = 0.0

    for anchor_position, node_index in enumerate(anchors[1:-1], start=1):
        left_index = anchors[anchor_position - 1]
        right_index = anchors[anchor_position + 1]
        left_sd = cumulative_sd[left_index]
        node_sd = cumulative_sd[node_index]
        right_sd = cumulative_sd[right_index]
        if node_sd - left_sd <= _SD_TOLERANCE_M or right_sd - node_sd <= _SD_TOLERANCE_M:
            continue
        node_pressure = saturation_pressures[node_index]
        incoming_from_inside = (actual_pressures[right_index] - node_pressure) / (right_sd - node_sd)
        outgoing_to_outside = (node_pressure - actual_pressures[left_index]) / (node_sd - left_sd)
        rate = STILL_AIR_VAPOR_PERMEABILITY_KG_M_S_PA * (incoming_from_inside - outgoing_to_outside)
        raw_change_g_m2 = rate * seconds * 1000.0
        prior_mass = accumulated_by_node.get(node_index, 0.0)
        effective_change = max(-prior_mass, raw_change_g_m2)
        next_mass = max(0.0, prior_mass + effective_change)
        if next_mass > _MASS_TOLERANCE_G_M2:
            next_accumulated[node_index] = next_mass
        if rate > 0:
            positive_condensation_nodes.add(node_index)
        if (
            abs(raw_change_g_m2) > _MASS_TOLERANCE_G_M2
            or prior_mass > _MASS_TOLERANCE_G_M2
            or next_mass > _MASS_TOLERANCE_G_M2
        ):
            interface_months.append(
                CondensationInterfaceMonth(
                    node_index=node_index,
                    outside_layer_id=layers[node_index - 1].layer.id,
                    inside_layer_id=layers[node_index].layer.id,
                    condensation_rate_kg_m2_s=rate,
                    moisture_change_g_m2=raw_change_g_m2,
                    accumulated_moisture_g_m2=next_mass,
                )
            )
        # ``gc`` is the unconstrained monthly flow from ISO 13788 / the PHI
        # workbook. Only ``Ma`` is clamped at zero; replacing gc with the
        # effective Ma delta would hide the available drying potential in the
        # month that closes the cycle.
        total_change_g_m2 += raw_change_g_m2

    surface_total_r = rse_m2k_w + total_layer_r + ISO_13788_SURFACE_CHECK_RSI
    surface_temp = boundary.interior_temp_c - (ISO_13788_SURFACE_CHECK_RSI / surface_total_r * temperature_delta)
    dewpoint_threshold = saturation_temperature_c(boundary.interior_vapor_pressure_pa)
    mold_threshold = saturation_temperature_c(boundary.interior_vapor_pressure_pa / 0.8)
    if temperature_delta <= 1.0e-9:
        # fRsi is a heating-period hygiene factor. With no outward heat loss,
        # the interior surface is not colder than the room, so the criterion
        # is clear and a denominator sign flip must not manufacture a failure.
        frsi = 1.0
        frsi_min = 0.0
    else:
        frsi = (surface_temp - boundary.exterior_profile_temp_c) / temperature_delta
        frsi_min = (mold_threshold - boundary.exterior_profile_temp_c) / temperature_delta

    nodes = [
        CondensationNodeProfile(
            node_index=node_index,
            outside_layer_id=layers[node_index - 1].layer.id if node_index > 0 else None,
            cumulative_thickness_m=cumulative_thickness[node_index],
            cumulative_sd_m=cumulative_sd[node_index],
            temperature_c=temperatures[node_index],
            saturation_pressure_pa=saturation_pressures[node_index],
            vapor_pressure_pa=actual_pressures[node_index],
            relative_humidity=actual_pressures[node_index] / saturation_pressures[node_index],
            is_condensing=node_index in positive_condensation_nodes,
        )
        for node_index in range(interior_node + 1)
    ]
    month = CondensationMonth(
        month=boundary.month_index + 1,
        month_name=MONTH_NAMES[boundary.month_index],
        exterior_air_temp_c=boundary.exterior_air_temp_c,
        exterior_profile_temp_c=boundary.exterior_profile_temp_c,
        exterior_rh=boundary.exterior_rh,
        interior_temp_c=boundary.interior_temp_c,
        interior_rh=boundary.interior_rh,
        exterior_vapor_pressure_pa=boundary.exterior_vapor_pressure_pa,
        interior_vapor_pressure_pa=boundary.interior_vapor_pressure_pa,
        interior_surface_temp_c=surface_temp,
        dewpoint_threshold_c=dewpoint_threshold,
        mold_threshold_c=mold_threshold,
        frsi=frsi,
        frsi_min=frsi_min,
        surface_condensation_clear=surface_temp >= dewpoint_threshold,
        mold_growth_clear=surface_temp >= mold_threshold,
        frsi_clear=frsi >= frsi_min,
        # Keep the condensation plane counted while stored moisture is drying.
        # This matches the workbook's "Interfaces with condensation" row; the
        # node-level ``is_condensing`` flag still identifies positive gc only.
        condensing_interface_count=len(interface_months),
        moisture_change_g_m2=total_change_g_m2,
        accumulated_moisture_g_m2=sum(next_accumulated.values()),
        nodes=nodes,
        interfaces=interface_months,
    )
    return month, next_accumulated


def _piecewise_pressures(
    cumulative_sd: Sequence[float],
    saturation_pressures: Sequence[float],
    active: set[int],
    exterior_pressure_pa: float,
    interior_pressure_pa: float,
) -> list[float]:
    last_index = len(cumulative_sd) - 1
    anchors = [0, *sorted(active), last_index]
    anchor_pressures = {
        0: exterior_pressure_pa,
        last_index: interior_pressure_pa,
        **{node_index: saturation_pressures[node_index] for node_index in active},
    }
    pressures = [0.0] * len(cumulative_sd)
    for left_index, right_index in zip(anchors, anchors[1:], strict=False):
        left_sd = cumulative_sd[left_index]
        right_sd = cumulative_sd[right_index]
        left_pressure = anchor_pressures[left_index]
        right_pressure = anchor_pressures[right_index]
        span = right_sd - left_sd
        for node_index in range(left_index, right_index + 1):
            if span <= _SD_TOLERANCE_M:
                pressures[node_index] = min(left_pressure, right_pressure)
            else:
                fraction = (cumulative_sd[node_index] - left_sd) / span
                pressures[node_index] = left_pressure + fraction * (right_pressure - left_pressure)
    return pressures


def _verdict(cycle: _Cycle, ma_limit_g_m2: float) -> CondensationVerdict:
    ever_condensed = any(
        interface.condensation_rate_kg_m2_s > 0 for month in cycle.months for interface in month.interfaces
    )
    if not ever_condensed:
        return "d1"
    if not cycle.closes:
        return "d4"
    if cycle.peak_mass_g_m2 > ma_limit_g_m2:
        return "d3"
    return "d2"


def _criteria(
    cycle: _Cycle,
    verdict: CondensationVerdict,
    ma_limit_g_m2: float,
) -> CondensationCriteria:
    surface_month = min(
        cycle.months,
        key=lambda month: month.interior_surface_temp_c - month.dewpoint_threshold_c,
    )
    mold_month = min(
        cycle.months,
        key=lambda month: month.interior_surface_temp_c - month.mold_threshold_c,
    )
    frsi_month = min(cycle.months, key=lambda month: month.frsi - month.frsi_min)
    interstitial_month = max(
        cycle.months,
        key=lambda month: month.accumulated_moisture_g_m2,
    )
    return CondensationCriteria(
        surface_condensation=CondensationCriterion(
            code="surface_condensation",
            is_clear=all(month.surface_condensation_clear for month in cycle.months),
            worst_month=surface_month.month,
            worst_month_name=surface_month.month_name,
            margin=surface_month.interior_surface_temp_c - surface_month.dewpoint_threshold_c,
        ),
        mold_growth=CondensationCriterion(
            code="mold_growth",
            is_clear=all(month.mold_growth_clear for month in cycle.months),
            worst_month=mold_month.month,
            worst_month_name=mold_month.month_name,
            margin=mold_month.interior_surface_temp_c - mold_month.mold_threshold_c,
        ),
        frsi=CondensationCriterion(
            code="frsi",
            is_clear=all(month.frsi_clear for month in cycle.months),
            worst_month=frsi_month.month,
            worst_month_name=frsi_month.month_name,
            margin=frsi_month.frsi - frsi_month.frsi_min,
        ),
        interstitial=CondensationCriterion(
            code="interstitial",
            is_clear=verdict in {"d1", "d2"},
            worst_month=interstitial_month.month,
            worst_month_name=interstitial_month.month_name,
            margin=ma_limit_g_m2 - cycle.peak_mass_g_m2,
        ),
    )


def _canonical_start_month(months: Sequence[CondensationMonth]) -> int:
    minimum = min(month.accumulated_moisture_g_m2 for month in months)
    minimum_months = [
        month.month - 1
        for month in months
        if math.isclose(
            month.accumulated_moisture_g_m2,
            minimum,
            rel_tol=0.0,
            abs_tol=_MASS_TOLERANCE_G_M2,
        )
    ]
    return (max(minimum_months) + 1) % 12


def _diagnostics(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
    film_table: SurfaceFilmTable,
) -> list[CondensationDiagnostic]:
    diagnostics: list[CondensationDiagnostic] = []
    if assembly.type == "roof":
        diagnostics.append(CondensationDiagnostic(code="roof_temperature_offset"))
    if assembly.exterior_condition == "ventilated":
        outermost = assembly.layers_outside_to_inside()[0]
        materials = [material for _, material in assigned_materials(outermost, materials_by_id)]
        if is_membrane_layer(outermost, materials_by_id) or any(_is_air_material(material) for material in materials):
            diagnostics.append(
                CondensationDiagnostic(
                    code="ventilated_stack_convention",
                    layer_id=outermost.id,
                )
            )
        if film_table.standard != "iso_6946":
            diagnostics.append(CondensationDiagnostic(code="iso_6946_exterior_rule_with_non_iso_films"))
    return diagnostics


def _material_caveats(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> list[CondensationCaveat]:
    masonry_ids = sorted(
        {
            material.id
            for layer in assembly.layers
            for segment in layer.segments
            if (material := materials_by_id.get(segment.project_material_id or "")) is not None
            and material.category.strip().casefold() == "masonry"
        }
    )
    return [CondensationCaveat(code="high_storage_masonry", material_ids=masonry_ids)] if masonry_ids else []


def _is_air_material(material: ProjectMaterial) -> bool:
    return material.category.strip().casefold() in AIR_CATEGORIES


def _verdict_severity(verdict: CondensationVerdict) -> int:
    return {"d1": 0, "d2": 1, "d3": 2, "d4": 3}[verdict]


def _dedupe_issues(issues: Sequence[CondensationIssue]) -> list[CondensationIssue]:
    unique: dict[tuple[object, ...], CondensationIssue] = {}
    for issue in issues:
        key = (
            issue.code,
            issue.layer_id,
            issue.segment_id,
            issue.project_material_id,
        )
        unique[key] = issue
    return list(unique.values())


def _dedupe_caveats(caveats: Sequence[CondensationCaveat]) -> list[CondensationCaveat]:
    unique: dict[CondensationCaveatCode, CondensationCaveat] = {}
    for caveat in caveats:
        existing = unique.get(caveat.code)
        if existing is None:
            unique[caveat.code] = caveat
            continue
        unique[caveat.code] = CondensationCaveat(
            code=caveat.code,
            material_ids=sorted({*existing.material_ids, *caveat.material_ids}),
        )
    return [unique[code] for code in sorted(unique)]


def _dedupe_diagnostics(
    diagnostics: Sequence[CondensationDiagnostic],
) -> list[CondensationDiagnostic]:
    unique: dict[tuple[CondensationDiagnosticCode, str | None], CondensationDiagnostic] = {}
    for diagnostic in diagnostics:
        unique[(diagnostic.code, diagnostic.layer_id)] = diagnostic
    return [unique[key] for key in sorted(unique)]


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))
