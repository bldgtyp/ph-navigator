import { ft2ToM2, ft3ToM3, ftToMm, inToMm, m2ToFt2, m3ToFt3, mmToFt, mmToIn } from "./length";
import {
  btuLbFToJKgK,
  cfmFt2ToLSM2,
  jKgKToBtuLbF,
  kgM3ToLbFt3,
  lbFt3ToKgM3,
  lSM2ToCfmFt2,
  isPositiveInfinity,
  muToPermIn,
  permInToMu,
  permToSdM,
  sdMToPerm,
} from "./material";
import { cToF, fToC } from "./temperature";
import {
  btuHFToWK,
  btuHft2FToWm2K,
  btuHftFToWmK,
  hft2FBtuToM2kW,
  m2kWToHft2FBtu,
  wkToBtuHF,
  wm2kToBtuHft2F,
  wmkToBtuHftF,
} from "./thermal";
import { cfmToM3h, m3hToCfm } from "./airflow";
import type { UnitSystem } from "./types";

export type NumberUnitMode = "editable" | "fixed";

const MIN_NUMBER_PRECISION = 0;
const MAX_NUMBER_PRECISION = 10;
const L_PER_GAL = 3.785411784;
const KWH_TO_KBTU = 3.412141633;
const KW_TO_KBTU_PER_H = 3.412141633;
const GRAINS_FT2_PER_G_M2 = 1.433076;
const GRAINS_FT2_PER_KG_M2 = GRAINS_FT2_PER_G_M2 * 1000;

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
    id: "thermal_resistance",
    label: "Thermal Resistance",
    siUnits: [{ id: "m2_k_w", label: "m2-K/W", system: "SI" }],
    ipUnits: [{ id: "h_ft2_f_btu", label: "h-ft2-F/Btu", system: "IP" }],
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
    id: "flow_rate",
    label: "Flow Rate",
    siUnits: [{ id: "l_min", label: "L/min", system: "SI" }],
    ipUnits: [{ id: "gpm", label: "gpm", system: "IP" }],
  },
  {
    id: "temperature",
    label: "Temperature",
    siUnits: [{ id: "c", label: "deg C", system: "SI" }],
    ipUnits: [{ id: "f", label: "deg F", system: "IP" }],
  },
  {
    id: "pressure",
    label: "Pressure",
    siUnits: [{ id: "pa", label: "Pa", system: "SI" }],
    ipUnits: [{ id: "pa", label: "Pa", system: "IP" }],
  },
  {
    id: "percentage",
    label: "Percentage",
    siUnits: [{ id: "percent", label: "%", system: "SI" }],
    ipUnits: [{ id: "percent", label: "%", system: "IP" }],
  },
  {
    id: "surface_mass",
    label: "Surface Mass",
    siUnits: [{ id: "g_m2", label: "g/m2", system: "SI" }],
    ipUnits: [{ id: "gr_ft2", label: "gr/ft2", system: "IP" }],
  },
  {
    id: "surface_mass_flux",
    label: "Surface Mass Flux",
    siUnits: [{ id: "kg_m2_s", label: "kg/(m2-s)", system: "SI" }],
    ipUnits: [{ id: "gr_ft2_s", label: "gr/(ft2-s)", system: "IP" }],
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
  {
    id: "energy",
    label: "Energy",
    siUnits: [{ id: "kwh", label: "kWh", system: "SI" }],
    ipUnits: [{ id: "kbtu", label: "kBtu", system: "IP" }],
  },
  {
    id: "power",
    label: "Power",
    siUnits: [{ id: "kw", label: "kW", system: "SI" }],
    ipUnits: [{ id: "kbtu_h", label: "kBtu/h", system: "IP" }],
  },
  {
    // ASTM E2178 air permeance. The test pressure (75 Pa / 1.57 psf) is part
    // of the quantity, not a separate field, so it is baked into both labels.
    id: "air_permeance",
    label: "Air Permeance",
    siUnits: [{ id: "l_s_m2_75pa", label: "L/(s-m2) @ 75Pa", system: "SI" }],
    ipUnits: [{ id: "cfm_ft2_75pa", label: "cfm/ft2 @ 1.57psf", system: "IP" }],
  },
  {
    id: "vapor_diffusion_resistance",
    label: "Vapor Diffusion Resistance",
    siUnits: [{ id: "mu", label: "mu", system: "SI" }],
    ipUnits: [{ id: "perm_in", label: "perm-in", system: "IP" }],
  },
  {
    id: "vapor_sd",
    label: "Equivalent Air-Layer Thickness",
    siUnits: [{ id: "sd_m", label: "m", system: "SI" }],
    ipUnits: [{ id: "perm", label: "perm", system: "IP" }],
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

export function numberUnitsForType(
  unitType: NumberUnitType,
  options: Pick<NumberUnitsConfig, "mode" | "precision_si" | "precision_ip">,
): NumberUnitsConfig {
  const definition = NUMBER_UNIT_TYPES_BY_ID.get(unitType) ?? NUMBER_UNIT_TYPES[0];
  return {
    mode: options.mode,
    unit_type: definition.id,
    si_unit: definition.siUnits[0].id,
    ip_unit: definition.ipUnits[0].id,
    precision_si: options.precision_si,
    precision_ip: options.precision_ip,
  };
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
    case "thermal_resistance":
      return m2kWToHft2FBtu(valueSi);
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
    case "flow_rate":
      return valueSi / L_PER_GAL;
    case "temperature":
      return cToF(valueSi);
    case "pressure":
    case "percentage":
      return valueSi;
    case "surface_mass":
      return valueSi * GRAINS_FT2_PER_G_M2;
    case "surface_mass_flux":
      return valueSi * GRAINS_FT2_PER_KG_M2;
    case "airflow":
      return m3hToCfm(valueSi);
    case "electric_efficiency":
      return valueSi / m3hToCfm(1);
    case "heat_loss_rate":
      return wkToBtuHF(valueSi);
    case "energy":
      return valueSi * KWH_TO_KBTU;
    case "power":
      return valueSi * KW_TO_KBTU_PER_H;
    case "air_permeance":
      return lSM2ToCfmFt2(valueSi);
    case "vapor_diffusion_resistance":
      return muToPermIn(valueSi);
    case "vapor_sd":
      return sdMToPerm(valueSi);
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
    case "thermal_resistance":
      return hft2FBtuToM2kW(valueIp);
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
    case "flow_rate":
      return valueIp * L_PER_GAL;
    case "temperature":
      return fToC(valueIp);
    case "pressure":
    case "percentage":
      return valueIp;
    case "surface_mass":
      return valueIp / GRAINS_FT2_PER_G_M2;
    case "surface_mass_flux":
      return valueIp / GRAINS_FT2_PER_KG_M2;
    case "airflow":
      return cfmToM3h(valueIp);
    case "electric_efficiency":
      return valueIp * m3hToCfm(1);
    case "heat_loss_rate":
      return btuHFToWK(valueIp);
    case "energy":
      return valueIp / KWH_TO_KBTU;
    case "power":
      return valueIp / KW_TO_KBTU_PER_H;
    case "air_permeance":
      return cfmFt2ToLSM2(valueIp);
    case "vapor_diffusion_resistance":
      return permInToMu(valueIp);
    case "vapor_sd":
      return permToSdM(valueIp);
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
  if (unitSystem === "IP" && config.unit_type === "vapor_sd" && numeric === 0) return "∞";
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
  if (unitSystem === "IP" && config.unit_type === "vapor_sd" && isPositiveInfinity(trimmed)) {
    return 0;
  }
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
