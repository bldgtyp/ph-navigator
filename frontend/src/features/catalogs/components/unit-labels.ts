import type { UnitSystem } from "../../../lib/units";

export function lengthUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "in" : "mm";
}

// These label a *column* whose cells are printed by the matching
// `lib/units` formatter, so they must spell the unit the way that formatter
// does — not the way `numberUnits.ts`'s registry does. The two already
// disagree: the registry's IP heat-flow is `Btu/hr-F`, while
// `formatHeatFlowFromWK` emits `Btu/(h-F)`. Reading the registry here would
// put one spelling in the header and another in every cell beneath it.
export function areaUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "ft2" : "m2";
}

export function heatFlowUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-F)" : "W/K";
}

export function uValueUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-ft2-F)" : "W/m2-K";
}

export function psiUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-ft-F)" : "W/m-K";
}

export function conductivityUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-ft-F)" : "W/m-K";
}

export function densityUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "lb/ft3" : "kg/m3";
}

export function specificHeatUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(lb-F)" : "J/(kg-K)";
}

// ASTM E2178 test pressure is part of the quantity, so it stays in the label.
export function airPermeanceUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "cfm/ft2 @ 1.57psf" : "L/(s-m2) @ 75Pa";
}

export function vaporMuUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "perm-in" : "mu";
}

export function vaporSdUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "perm" : "m";
}
