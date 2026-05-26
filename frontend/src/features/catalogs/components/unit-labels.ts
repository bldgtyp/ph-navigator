import type { UnitSystem } from "../../../lib/units";

export function lengthUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "in" : "mm";
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
