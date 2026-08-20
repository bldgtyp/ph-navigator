import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatNumberWithUnit,
  formatRPerInFromConductivityWmK,
  formatSpecificHeatFromJKgK,
  type UnitSystem,
} from "../../lib/units";
import type { ProjectMaterial } from "./types";

export type AssemblyMaterialHeader = {
  label: string;
  unit: string | null;
};

export type AssemblyMaterialValueLabels = {
  valueLabel: string;
  densityLabel: string;
  specificHeatLabel: string;
  emissivityLabel: string;
};

export function assemblyMaterialHeaders(
  units: UnitSystem,
): [
  AssemblyMaterialHeader,
  AssemblyMaterialHeader,
  AssemblyMaterialHeader,
  AssemblyMaterialHeader,
  AssemblyMaterialHeader,
  AssemblyMaterialHeader,
] {
  return [
    { label: "Color", unit: null },
    { label: "Material", unit: null },
    units === "IP"
      ? { label: "Resistivity", unit: "R/inch" }
      : { label: "Conductivity", unit: "W/(m-K)" },
    { label: "Density", unit: units === "IP" ? "lb/ft3" : "kg/m3" },
    {
      label: "Specific heat",
      unit: units === "IP" ? "Btu/(lb-F)" : "J/(kg-K)",
    },
    { label: "Emissivity", unit: null },
  ];
}

export function formatAssemblyMaterialValues(
  material: ProjectMaterial,
  units: UnitSystem,
  empty: string,
): AssemblyMaterialValueLabels {
  return {
    valueLabel:
      units === "IP"
        ? formatRPerInFromConductivityWmK(material.conductivity_w_mk, {
            unitSystem: units,
            empty,
            fractionDigits: 3,
            showUnit: false,
          })
        : formatConductivityFromWmK(material.conductivity_w_mk, {
            unitSystem: units,
            empty,
            fractionDigits: 3,
            showUnit: false,
          }),
    densityLabel: formatDensityFromKgM3(material.density_kg_m3, {
      unitSystem: units,
      empty,
      fractionDigits: 1,
      showUnit: false,
    }),
    specificHeatLabel: formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, {
      unitSystem: units,
      empty,
      fractionDigits: units === "IP" ? 3 : 0,
      showUnit: false,
    }),
    emissivityLabel: formatNumberWithUnit(material.emissivity, "", {
      unitSystem: units,
      empty,
      fractionDigits: 3,
      showUnit: false,
    }),
  };
}
