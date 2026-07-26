"""Surface film resistances and heat-flow direction for assemblies.

An assembly's boundary conditions decompose into two independent axes:

* the **interior** side is fully determined by ``Assembly.type`` — a roof
  loses heat upward, a floor downward, a wall horizontally — so there is
  nothing for the user to choose and nothing to store;
* the **exterior** side is the one user-selectable axis,
  ``Assembly.exterior_condition``.

Together with the project's ``thermal_standard`` they resolve a
deterministic ``(rsi, rse, heat_flow_direction)`` triple. Putting type on
the *assembly* is a deliberate divergence from honeybee-energy, whose
``OpaqueConstruction`` carries no type or direction (those only exist once
a construction is assigned to a geometric ``Face``). It is what lets PHN —
like PHPP — resolve a surface film without a geometric model, and
therefore what makes an ISO 13788 analysis possible at all.

These films are *not* the ``air_*`` catalog materials. Those are air
**cavities** inside the construction with an equivalent conductivity; a
film is the boundary-layer resistance at a face. Both can be present in
one assembly and neither substitutes for the other.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from features.project_document.document import AssemblyType, ExteriorCondition, ThermalStandard

HeatFlowDirection = Literal["upward", "horizontal", "downward"]

#: ISO 6946 evaluates the horizontal band across ±30° of horizontal, which
#: is a wide catchment, and 0.13 is the middle of the three values — so
#: ``other`` maps there as the least-wrong default when the real direction
#: is unknown. The UI surfaces that as a visible assumption.
_HEAT_FLOW_BY_ASSEMBLY_TYPE: dict[AssemblyType, HeatFlowDirection] = {
    "roof": "upward",
    "wall": "horizontal",
    "floor": "downward",
    "other": "horizontal",
}

#: ISO 6946 Table 1 (internal surface resistance, m²·K/W).
_ISO_6946_RSI: dict[HeatFlowDirection, float] = {
    "upward": 0.10,
    "horizontal": 0.13,
    "downward": 0.17,
}

#: ISO 6946 Table 1 (external surface resistance) for a face exposed to
#: moving outdoor air. Direction-independent, unlike Rsi.
_ISO_6946_OUTDOOR_AIR_RSE = 0.04

#: ISO 13788's surface-condensation and mould criteria are evaluated at a
#: second, higher internal resistance — the furniture-and-corner
#: allowance — and fRsi is defined against it. Owned by the condensation
#: screen; it must never reach a U-value.
ISO_13788_SURFACE_CHECK_RSI = 0.25


@dataclass(frozen=True)
class SurfaceResistances:
    """The film resistances and heat-flow direction in force for one assembly."""

    rsi_m2k_w: float
    rse_m2k_w: float
    heat_flow_direction: HeatFlowDirection
    standard: ThermalStandard

    @property
    def total_film_r_m2k_w(self) -> float:
        return self.rsi_m2k_w + self.rse_m2k_w


def heat_flow_direction(assembly_type: AssemblyType) -> HeatFlowDirection:
    """Return the ISO 6946 heat-flow direction implied by an assembly type."""

    return _HEAT_FLOW_BY_ASSEMBLY_TYPE[assembly_type]


def resolve_surface_resistances(
    assembly_type: AssemblyType,
    exterior_condition: ExteriorCondition,
    standard: ThermalStandard = "iso_6946",
) -> SurfaceResistances:
    """Resolve ``(Rsi, Rse, direction)`` from the assembly's two boundary axes.

    Rse follows ISO 6946 §6: a well-ventilated layer and everything
    outboard of it are ignored, and the exterior surface is then treated as
    an internal one — hence ``Rse = Rsi`` for a ventilated cavity.
    ``unconditioned_space`` resolves identically **today**; the two are
    separate values because they mean different things and because the
    temperature treatment that will distinguish them (Ft) is deferred to
    the condensation screen. Ground contact gets no film at all.
    """
    direction = heat_flow_direction(assembly_type)
    rsi = _ISO_6946_RSI[direction]
    if exterior_condition == "ground":
        rse = 0.0
    elif exterior_condition == "outdoor_air":
        rse = _ISO_6946_OUTDOOR_AIR_RSE
    else:
        rse = rsi
    return SurfaceResistances(
        rsi_m2k_w=rsi,
        rse_m2k_w=rse,
        heat_flow_direction=direction,
        standard=standard,
    )
