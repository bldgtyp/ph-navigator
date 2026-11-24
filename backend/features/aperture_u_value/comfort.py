"""Phius window thermal-comfort screening (per-lite U_max check).

Implements the Phius 2024-r1 window thermal-comfort criterion (N-3, 1.3.3.3,
1.4.2.6): for each non-exempt glazed lite, derive its head height above
finished floor (HHS) from the aperture's ``sill_height_mm`` and
``row_heights_mm`` (row 0 is the top row), compute ``ΔT_max`` and ``U_max``
from the project's ASHRAE 99% heating design dry-bulb temperature (``Td``),
and evaluate both the project-specific whole-window U (from
``aperture_u_value``) and the optional NFRC standard-size whole-window U.

This is a pre-flight compliance screen — the official Phius Window Comfort
Applet remains the certification submittal artifact.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.aperture_u_value.models import ApertureUValueResult
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentTables,
)
from features.project_document.models import ProjectDocumentSource

PHIUS_COMFORT_RULESET = "phius-2024-r1"
PHIUS_INTERIOR_DESIGN_TEMP_F = 68.0
PHIUS_INTERIOR_FILM_R_IP = 0.74
U_IP_TO_SI = 5.6782633411
MM_PER_FOOT = 304.8

ComfortState = Literal["pass", "fail", "exempt", "alternative", "blocked"]
ComfortGoverningRoute = Literal["project_specific", "nfrc_standard"]
ComfortBlockedReason = Literal[
    "missing_sill_height",
    "missing_climate_source",
    "missing_element_u_value",
    "no_glazed_elements",
]


class ApertureElementComfortResult(BaseModel):
    """Per-lite Phius thermal-comfort evaluation result."""

    model_config = ConfigDict(extra="forbid")

    element_id: str
    element_name: str
    row_span: tuple[int, int]
    column_span: tuple[int, int]
    head_height_mm: float | None = None
    delta_t_max_f: float | None = None
    u_max_w_m2k: float | None = None
    u_project_specific_w_m2k: float | None = None
    u_nfrc_standard_w_m2k: float | None = None
    governing_route: ComfortGoverningRoute | None = None
    margin: float | None = None
    state: ComfortState
    comfort_exempt: bool = False
    comfort_exempt_reason: Literal["non_regularly_occupied", "ada_door"] | None = None
    perimeter_heat_within_3ft: bool = False
    perimeter_heat_note: str | None = None
    nfrc_route_missing_caveat: bool = False


class ApertureThermalComfortResult(BaseModel):
    """Aperture-type roll-up (worst element state; never area-weighted)."""

    model_config = ConfigDict(extra="forbid")

    aperture_type_id: str
    aperture_type_name: str
    sill_height_mm: float | None = None
    nfrc_whole_window_u_w_m2k: float | None = None
    nfrc_standard_size_note: str | None = None
    state: ComfortState
    blocked_reasons: list[ComfortBlockedReason] = Field(default_factory=list)
    failing_count: int = 0
    governing_element_id: str | None = None
    governing_element_name: str | None = None
    heating_990_db_c: float | None = None
    climate_source_label: str | None = None
    climate_source_basis: str | None = None
    ruleset: str = PHIUS_COMFORT_RULESET
    elements: list[ApertureElementComfortResult] = Field(default_factory=list)


class AperturesThermalComfortListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    apertures: list[ApertureThermalComfortResult]


def derive_element_head_height_mm(entry: ApertureTypeEntry, element: ApertureElement) -> float:
    """Derive a lite's head height above finished floor in millimeters.

    Row 0 is the top row of the aperture grid, so the head of an element
    starting at ``row_span[0]`` sits at::

        sill_height_mm + sum(row_heights_mm) - sum(row_heights_mm[:row_span[0]])
    """
    assert entry.sill_height_mm is not None
    total_height_mm = sum(entry.row_heights_mm)
    above_mm = sum(entry.row_heights_mm[: element.row_span[0]])
    return entry.sill_height_mm + total_height_mm - above_mm


def compute_phius_u_max(head_height_mm: float, td_c: float) -> tuple[float, float | None, float | None]:
    """Return ``(delta_t_max_f, u_max_ip, u_max_w_m2k)`` per Phius 2024-r1."""
    hhs_ft = head_height_mm / MM_PER_FOOT
    delta_t_max_f = max(6.0, min(13.3, 14.7 - 0.742 * hhs_ft))
    td_f = td_c * 9.0 / 5.0 + 32.0
    delta_t_design_f = PHIUS_INTERIOR_DESIGN_TEMP_F - td_f
    if delta_t_design_f <= 0:
        return delta_t_max_f, None, None
    u_max_ip = delta_t_max_f / (PHIUS_INTERIOR_FILM_R_IP * delta_t_design_f)
    u_max_w_m2k = u_max_ip * U_IP_TO_SI
    return delta_t_max_f, u_max_ip, u_max_w_m2k


def evaluate_aperture_thermal_comfort(
    entry: ApertureTypeEntry,
    tables: ProjectDocumentTables,
    *,
    u_result: ApertureUValueResult | None = None,
    heating_990_db_c: float | None,
    climate_source_label: str | None = None,
    climate_source_basis: str | None = None,
) -> ApertureThermalComfortResult:
    """Evaluate every glazed element in ``entry`` against the Phius U_max limit."""
    computed_u = u_result if u_result is not None else calculate_aperture_u_values(entry, tables)
    u_by_element_id = {el.element_id: el for el in computed_u.elements}
    glazed_elements = [el for el in entry.elements if el.kind != "void"]

    blocked_reasons: list[ComfortBlockedReason] = []
    if not glazed_elements:
        blocked_reasons.append("no_glazed_elements")
    if entry.sill_height_mm is None:
        blocked_reasons.append("missing_sill_height")
    if heating_990_db_c is None:
        blocked_reasons.append("missing_climate_source")

    element_results: list[ApertureElementComfortResult] = []
    any_missing_u = False

    for element in glazed_elements:
        head_height_mm = derive_element_head_height_mm(entry, element) if entry.sill_height_mm is not None else None
        u_el = u_by_element_id.get(element.id)
        u_proj = u_el.u_value_w_m2k if u_el is not None and not u_el.warnings and u_el.u_value_w_m2k > 0 else None
        u_nfrc = entry.nfrc_whole_window_u_w_m2k

        delta_t_max_f: float | None = None
        u_max_w_m2k: float | None = None
        if head_height_mm is not None and heating_990_db_c is not None:
            delta_t_max_f, _, u_max_w_m2k = compute_phius_u_max(head_height_mm, heating_990_db_c)

        if element.comfort_exempt:
            state: ComfortState = "exempt"
            governing_route: ComfortGoverningRoute | None = None
            margin: float | None = None
            nfrc_caveat = False
        elif element.perimeter_heat_within_3ft:
            state = "alternative"
            governing_route, margin = _pick_best_route(u_proj, u_nfrc, u_max_w_m2k)
            nfrc_caveat = False
        elif entry.sill_height_mm is None or heating_990_db_c is None:
            state = "blocked"
            governing_route = None
            margin = None
            nfrc_caveat = False
        elif u_max_w_m2k is None:
            # Mild design climate (Td >= 68 °F): no heating comfort restriction.
            state = "pass"
            governing_route = (
                "project_specific" if u_proj is not None else ("nfrc_standard" if u_nfrc is not None else None)
            )
            margin = 0.0
            nfrc_caveat = False
        elif u_proj is None and u_nfrc is None:
            state = "blocked"
            any_missing_u = True
            governing_route = None
            margin = None
            nfrc_caveat = False
        else:
            proj_pass = u_proj is not None and u_proj <= u_max_w_m2k
            nfrc_pass = u_nfrc is not None and u_nfrc <= u_max_w_m2k
            if proj_pass or nfrc_pass:
                state = "pass"
                if proj_pass and nfrc_pass:
                    assert u_proj is not None and u_nfrc is not None
                    if u_proj <= u_nfrc:
                        governing_route = "project_specific"
                        margin = u_proj / u_max_w_m2k
                    else:
                        governing_route = "nfrc_standard"
                        margin = u_nfrc / u_max_w_m2k
                elif proj_pass:
                    assert u_proj is not None
                    governing_route = "project_specific"
                    margin = u_proj / u_max_w_m2k
                else:
                    assert u_nfrc is not None
                    governing_route = "nfrc_standard"
                    margin = u_nfrc / u_max_w_m2k
                nfrc_caveat = False
            else:
                state = "fail"
                governing_route, margin = _pick_best_route(u_proj, u_nfrc, u_max_w_m2k)
                nfrc_caveat = u_nfrc is None

        element_results.append(
            ApertureElementComfortResult(
                element_id=element.id,
                element_name=element.name,
                row_span=element.row_span,
                column_span=element.column_span,
                head_height_mm=head_height_mm,
                delta_t_max_f=delta_t_max_f,
                u_max_w_m2k=u_max_w_m2k,
                u_project_specific_w_m2k=u_proj,
                u_nfrc_standard_w_m2k=u_nfrc,
                governing_route=governing_route,
                margin=margin,
                state=state,
                comfort_exempt=element.comfort_exempt,
                comfort_exempt_reason=element.comfort_exempt_reason,
                perimeter_heat_within_3ft=element.perimeter_heat_within_3ft,
                perimeter_heat_note=element.perimeter_heat_note,
                nfrc_route_missing_caveat=nfrc_caveat,
            )
        )

    if any_missing_u and "missing_element_u_value" not in blocked_reasons:
        blocked_reasons.append("missing_element_u_value")

    failing_count = sum(1 for item in element_results if item.state == "fail")
    overall_state = _rollup_state(element_results, blocked_reasons)
    governing = _governing_element(element_results)

    return ApertureThermalComfortResult(
        aperture_type_id=entry.id,
        aperture_type_name=entry.name,
        sill_height_mm=entry.sill_height_mm,
        nfrc_whole_window_u_w_m2k=entry.nfrc_whole_window_u_w_m2k,
        nfrc_standard_size_note=entry.nfrc_standard_size_note,
        state=overall_state,
        blocked_reasons=blocked_reasons,
        failing_count=failing_count,
        governing_element_id=governing.element_id if governing else None,
        governing_element_name=governing.element_name if governing else None,
        heating_990_db_c=heating_990_db_c,
        climate_source_label=climate_source_label,
        climate_source_basis=climate_source_basis,
        elements=element_results,
    )


def _pick_best_route(
    u_proj: float | None,
    u_nfrc: float | None,
    u_max: float | None,
) -> tuple[ComfortGoverningRoute | None, float | None]:
    if u_max is None or u_max <= 0:
        return None, None
    candidates: list[tuple[ComfortGoverningRoute, float]] = []
    if u_proj is not None:
        candidates.append(("project_specific", u_proj))
    if u_nfrc is not None:
        candidates.append(("nfrc_standard", u_nfrc))
    if not candidates:
        return None, None
    route, best_u = min(candidates, key=lambda pair: pair[1])
    return route, best_u / u_max


def _rollup_state(
    elements: list[ApertureElementComfortResult],
    blocked_reasons: list[ComfortBlockedReason],
) -> ComfortState:
    if not elements:
        return "blocked"
    states = {el.state for el in elements}
    if "fail" in states:
        return "fail"
    if "blocked" in states or blocked_reasons:
        return "blocked"
    if "alternative" in states:
        return "alternative"
    if "pass" in states:
        return "pass"
    return "exempt"


def _governing_element(elements: list[ApertureElementComfortResult]) -> ApertureElementComfortResult | None:
    non_exempt = [el for el in elements if el.state != "exempt"]
    if not non_exempt:
        return None
    with_height = [el for el in non_exempt if el.head_height_mm is not None]
    if with_height:
        return max(with_height, key=lambda el: (el.head_height_mm or 0.0, el.margin or 0.0))
    return non_exempt[0]
