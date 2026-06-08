import { ft2ToM2, ft3ToM3, ftToMm, inToMm, m2ToFt2, m3ToFt3, mmToFt, mmToIn } from "./length";
import { btuLbFToJKgK, jKgKToBtuLbF, kgM3ToLbFt3, lbFt3ToKgM3 } from "./material";
import { cToF, fToC } from "./temperature";
import { btuHft2FToWm2K, btuHftFToWmK, wm2kToBtuHft2F, wmkToBtuHftF } from "./thermal";
import { cfmToM3h, m3hToCfm } from "./airflow";
import type { UnitSystem } from "./types";

export type NumberUnitMode = "editable" | "fixed";

const MIN_NUMBER_PRECISION = 0;
const MAX_NUMBER_PRECISION = 10;
const L_PER_GAL = 3.785411784;
const W_PER_K_TO_BTU_PER_H_F = 3.412141633 / 1.8;

type UnitDefinitionInput = {
  id: string;
  label: string;
  system: UnitSystem;
};

type UnitTypeDefinitionInput = {
  id: string;
  label: string;
  siUnits: readonly UnitDefinitionInput[];
  ipUnits: readonly UnitDefinitionInput[];
};

export const NUMBER_UNIT_TYPES = [
  {
    id: "density",
    label: "Density",
    siUnits: [{ id: "kg_m3", label: "kg/m3", system: "SI" }],
    ipUnits: [{ id: "lb_ft3", label: "lb/ft3", system: "IP" }],
  },
  {
    id: "conductivity",
    label: "Conductivity",
    siUnits: [{ id: "w_m_k", label: "W/(m-K)", system: "SI" }],
    ipUnits: [{ id: "btu_h_ft_f", label: "Btu/(h-ft-F)", system: "IP" }],
  },
  {
    id: "u_value",
    label: "U-value",
    siUnits: [{ id: "w_m2_k", label: "W/(m2-K)", system: "SI" }],
    ipUnits: [{ id: "btu_h_ft2_f", label: "Btu/(h-ft2-F)", system: "IP" }],
  },
  {
    id: "specific_heat",
    label: "Specific Heat",
    siUnits: [{ id: "j_kg_k", label: "J/(kg-K)", system: "SI" }],
    ipUnits: [{ id: "btu_lb_f", label: "Btu/(lb-F)", system: "IP" }],
  },
  {
    id: "length",
    label: "Length",
    siUnits: [{ id: "m", label: "m", system: "SI" }],
    ipUnits: [{ id: "ft", label: "ft", system: "IP" }],
  },
  {
    // Small-scale length stored in millimetres. Used by frame profile width
    // and similar millimetre-precision dimensions where ft is too coarse.
    id: "length_mm",
    label: "Length (mm)",
    siUnits: [{ id: "mm", label: "mm", system: "SI" }],
    ipUnits: [{ id: "in", label: "in", system: "IP" }],
  },
  {
    id: "area",
    label: "Area",
    siUnits: [{ id: "m2", label: "m2", system: "SI" }],
    ipUnits: [{ id: "ft2", label: "ft2", system: "IP" }],
  },
  {
    id: "volume",
    label: "Volume",
    siUnits: [{ id: "m3", label: "m3", system: "SI" }],
    ipUnits: [{ id: "ft3", label: "ft3", system: "IP" }],
  },
  {
    id: "volume_liters",
    label: "Volume (L)",
    siUnits: [{ id: "l", label: "L", system: "SI" }],
    ipUnits: [{ id: "gal", label: "gal", system: "IP" }],
  },
  {
    id: "temperature",
    label: "Temperature",
    siUnits: [{ id: "c", label: "deg C", system: "SI" }],
    ipUnits: [{ id: "f", label: "deg F", system: "IP" }],
  },
  {
    id: "airflow",
    label: "Airflow",
    siUnits: [{ id: "m3_h", label: "m3/h", system: "SI" }],
    ipUnits: [{ id: "cfm", label: "cfm", system: "IP" }],
  },
  {
    id: "electric_efficiency",
    label: "Electrical Efficiency",
    siUnits: [{ id: "wh_m3", label: "Wh/m3", system: "SI" }],
    ipUnits: [{ id: "w_cfm", label: "W/cfm", system: "IP" }],
  },
  {
    id: "heat_loss_rate",
    label: "Heat Loss Rate",
    siUnits: [{ id: "w_k", label: "W/K", system: "SI" }],
    ipUnits: [{ id: "btu_h_f", label: "Btu/hr-F", system: "IP" }],
  },
] as const satisfies readonly UnitTypeDefinitionInput[];

export type NumberUnitType = (typeof NUMBER_UNIT_TYPES)[number]["id"];

export type NumberSiUnit = (typeof NUMBER_UNIT_TYPES)[number]["siUnits"][number]["id"];

export type NumberIpUnit = (typeof NUMBER_UNIT_TYPES)[number]["ipUnits"][number]["id"];

export type NumberUnitId = NumberSiUnit | NumberIpUnit;

export type NumberUnitDefinition = {
  id: NumberUnitId;
  label: string;
  system: UnitSystem;
};

export type NumberUnitTypeDefinition = {
  id: NumberUnitType;
  label: string;
  siUnits: readonly NumberUnitDefinition[];
  ipUnits: readonly NumberUnitDefinition[];
};

export type NumberUnitsConfig = {
  mode: NumberUnitMode;
  unit_type: NumberUnitType;
  si_unit: NumberSiUnit;
  ip_unit: NumberIpUnit;
  precision_si: number;
  precision_ip: number;
};

const NUMBER_UNIT_TYPES_BY_ID: ReadonlyMap<string, (typeof NUMBER_UNIT_TYPES)[number]> = new Map(
  NUMBER_UNIT_TYPES.map((entry) => [entry.id, entry]),
);

const NUMBER_UNIT_LABELS: ReadonlyMap<string, string> = new Map(
  NUMBER_UNIT_TYPES.flatMap((unitType) =>
    [...unitType.siUnits, ...unitType.ipUnits].map((unit) => [unit.id, unit.label] as const),
  ),
);

export function isNumberUnitsConfig(value: unknown): value is NumberUnitsConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NumberUnitsConfig>;
  return (
    (candidate.mode === "editable" || candidate.mode === "fixed") &&
    typeof candidate.unit_type === "string" &&
    typeof candidate.si_unit === "string" &&
    typeof candidate.ip_unit === "string" &&
    isValidNumberUnitPrecision(candidate.precision_si) &&
    isValidNumberUnitPrecision(candidate.precision_ip) &&
    isCompatibleNumberUnitPair(candidate.unit_type, candidate.si_unit, candidate.ip_unit)
  );
}

export function isCompatibleNumberUnitPair(
  unitType: string,
  siUnit: string,
  ipUnit: string,
): unitType is NumberUnitType {
  const definition = NUMBER_UNIT_TYPES_BY_ID.get(unitType);
  if (!definition) return false;
  return (
    definition.siUnits.some((unit) => unit.id === siUnit) &&
    definition.ipUnits.some((unit) => unit.id === ipUnit)
  );
}

export function numberUnitLabel(unitId: NumberUnitId): string {
  return NUMBER_UNIT_LABELS.get(unitId) ?? unitId;
}

export function numberUnitRegistrySnapshot(): Record<string, { si: string[]; ip: string[] }> {
  return Object.fromEntries(
    NUMBER_UNIT_TYPES.map((unitType) => [
      unitType.id,
      {
        si: unitType.siUnits.map((unit) => unit.id),
        ip: unitType.ipUnits.map((unit) => unit.id),
      },
    ]),
  );
}

export function numberUnitPrecision(config: NumberUnitsConfig, unitSystem: UnitSystem): number {
  return unitSystem === "IP" ? config.precision_ip : config.precision_si;
}

export function numberUnitForSystem(
  config: NumberUnitsConfig,
  unitSystem: UnitSystem,
): NumberUnitId {
  return unitSystem === "IP" ? config.ip_unit : config.si_unit;
}

export function convertNumberUnitsToDisplay(valueSi: number, config: NumberUnitsConfig): number {
  switch (config.unit_type) {
    case "density":
      return kgM3ToLbFt3(valueSi);
    case "conductivity":
      return wmkToBtuHftF(valueSi);
    case "u_value":
      return wm2kToBtuHft2F(valueSi);
    case "specific_heat":
      return jKgKToBtuLbF(valueSi);
    case "length":
      return mmToFt(valueSi * 1000);
    case "length_mm":
      return mmToIn(valueSi);
    case "area":
      return m2ToFt2(valueSi);
    case "volume":
      return m3ToFt3(valueSi);
    case "volume_liters":
      return valueSi / L_PER_GAL;
    case "temperature":
      return cToF(valueSi);
    case "airflow":
      return m3hToCfm(valueSi);
    case "electric_efficiency":
      return valueSi / m3hToCfm(1);
    case "heat_loss_rate":
      return valueSi * W_PER_K_TO_BTU_PER_H_F;
  }
}

export function convertNumberUnitsToSi(valueIp: number, config: NumberUnitsConfig): number {
  switch (config.unit_type) {
    case "density":
      return lbFt3ToKgM3(valueIp);
    case "conductivity":
      return btuHftFToWmK(valueIp);
    case "u_value":
      return btuHft2FToWm2K(valueIp);
    case "specific_heat":
      return btuLbFToJKgK(valueIp);
    case "length":
      return ftToMm(valueIp) / 1000;
    case "length_mm":
      return inToMm(valueIp);
    case "area":
      return ft2ToM2(valueIp);
    case "volume":
      return ft3ToM3(valueIp);
    case "volume_liters":
      return valueIp * L_PER_GAL;
    case "temperature":
      return fToC(valueIp);
    case "airflow":
      return cfmToM3h(valueIp);
    case "electric_efficiency":
      return valueIp * m3hToCfm(1);
    case "heat_loss_rate":
      return valueIp / W_PER_K_TO_BTU_PER_H_F;
  }
}

// Format a canonical SI value as the bare displayed number for the
// active unit system. Returns "" when the value is null/undefined or
// not finite — empty cells render as blank, matching plain Number.
export function formatNumberUnitsDisplay(
  valueSi: unknown,
  config: NumberUnitsConfig,
  unitSystem: UnitSystem,
): string {
  if (valueSi === null || valueSi === undefined || valueSi === "") return "";
  const numeric = typeof valueSi === "number" ? valueSi : Number(valueSi);
  if (!Number.isFinite(numeric)) return "";
  const displayed = unitSystem === "IP" ? convertNumberUnitsToDisplay(numeric, config) : numeric;
  return displayed.toFixed(numberUnitPrecision(config, unitSystem));
}

// Parse a bare displayed number string (active unit system) back to a
// canonical SI numeric value. Blank string → null; an unparseable
// string → undefined so callers can distinguish "user cleared the cell"
// from "user typed something we couldn't read".
export function parseNumberUnitsInput(
  raw: string,
  config: NumberUnitsConfig,
  unitSystem: UnitSystem,
): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return unitSystem === "IP" ? convertNumberUnitsToSi(parsed, config) : parsed;
}

function isValidNumberUnitPrecision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_NUMBER_PRECISION &&
    value <= MAX_NUMBER_PRECISION
  );
}
