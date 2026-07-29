import { m3sToCfm } from "./airflow";
import { formatNumberWithUnit, parseDecimalInput } from "./format";
import { m2ToFt2 } from "./length";
import type { UnitFormatOptions, UnitParseResult } from "./types";

const LB_FT3_PER_KG_M3 = 0.06242796;
const BTU_LB_F_PER_J_KG_K = 0.0002388458966275;
// ASTM E2178 air permeance is a volume flow per unit area, so its factor is
// composed from the canonical flow and area conversions rather than typed as a
// fresh literal — a hand-entered ratio drifts from them silently.
// Sanity check on the result (0.1968504): the air-barrier material criterion
// of 0.02 L/(s-m2) lands on 0.0039 cfm/ft2, the published IP threshold.
const CFM_FT2_PER_L_S_M2 = m3sToCfm(0.001) / m2ToFt2(1);
// Water-vapor conversions from the feature's ISO/US unit research. These are
// reciprocal quantities: higher SI resistance means lower US permeability.
const MU_PER_PERM_IN = 137.6;
const SD_M_PER_PERM = 3.496;

export function kgM3ToLbFt3(valueKgM3: number): number {
  return valueKgM3 * LB_FT3_PER_KG_M3;
}

export function lbFt3ToKgM3(valueLbFt3: number): number {
  return valueLbFt3 / LB_FT3_PER_KG_M3;
}

export function jKgKToBtuLbF(valueJKgK: number): number {
  return valueJKgK * BTU_LB_F_PER_J_KG_K;
}

export function btuLbFToJKgK(valueBtuLbF: number): number {
  return valueBtuLbF / BTU_LB_F_PER_J_KG_K;
}

export function lSM2ToCfmFt2(valueLSM2: number): number {
  return valueLSM2 * CFM_FT2_PER_L_S_M2;
}

export function cfmFt2ToLSM2(valueCfmFt2: number): number {
  return valueCfmFt2 / CFM_FT2_PER_L_S_M2;
}

export function muToPermIn(valueMu: number): number {
  return MU_PER_PERM_IN / valueMu;
}

export function permInToMu(valuePermIn: number): number {
  return MU_PER_PERM_IN / valuePermIn;
}

export function sdMToPerm(valueSdM: number): number {
  return SD_M_PER_PERM / valueSdM;
}

export function permToSdM(valuePerm: number): number {
  return SD_M_PER_PERM / valuePerm;
}

export function formatDensityFromKgM3(
  valueKgM3: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueKgM3 === null || valueKgM3 === undefined ? valueKgM3 : kgM3ToLbFt3(valueKgM3),
        "lb/ft3",
        { fractionDigits: 1, ...options },
      )
    : formatNumberWithUnit(valueKgM3, "kg/m3", { fractionDigits: 1, ...options });
}

export function parseDensityToKgM3(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter density." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "Density cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? lbFt3ToKgM3(parsed) : parsed };
}

export function formatSpecificHeatFromJKgK(
  valueJKgK: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueJKgK === null || valueJKgK === undefined ? valueJKgK : jKgKToBtuLbF(valueJKgK),
        "Btu/(lb-F)",
        { fractionDigits: 3, ...options },
      )
    : formatNumberWithUnit(valueJKgK, "J/(kg-K)", { fractionDigits: 0, ...options });
}

export function parseSpecificHeatToJKgK(
  input: string,
  options: UnitFormatOptions,
): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter specific heat." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0)
    return { ok: false, code: "negative", message: "Specific heat cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? btuLbFToJKgK(parsed) : parsed };
}

export function formatAirPermeanceFromLSM2(
  valueLSM2: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueLSM2 === null || valueLSM2 === undefined ? valueLSM2 : lSM2ToCfmFt2(valueLSM2),
        "cfm/ft2 @ 1.57psf",
        { fractionDigits: 4, ...options },
      )
    : formatNumberWithUnit(valueLSM2, "L/(s-m2) @ 75Pa", { fractionDigits: 4, ...options });
}

export function parseAirPermeanceToLSM2(
  input: string,
  options: UnitFormatOptions,
): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter air permeance." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0)
    return { ok: false, code: "negative", message: "Air permeance cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? cfmFt2ToLSM2(parsed) : parsed };
}

export function formatVaporMu(
  valueMu: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueMu === null || valueMu === undefined ? valueMu : muToPermIn(valueMu),
        "perm-in",
        { fractionDigits: 2, ...options },
      )
    : formatNumberWithUnit(valueMu, "mu", { fractionDigits: 1, ...options });
}

export function parseVaporMu(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter vapor resistance." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed <= 0)
    return {
      ok: false,
      code: "negative",
      message:
        options.unitSystem === "IP"
          ? "Permeability must be greater than zero."
          : "Mu must be at least 1.",
    };
  const valueSi = options.unitSystem === "IP" ? permInToMu(parsed) : parsed;
  if (valueSi < 1) return { ok: false, code: "out_of_range", message: "Mu must be at least 1." };
  return { ok: true, valueSi };
}

export function formatVaporSd(
  valueSdM: number | null | undefined,
  options: UnitFormatOptions,
): string {
  if (options.unitSystem === "IP" && valueSdM === 0) {
    return options.showUnit === false ? "∞" : "∞ perm";
  }
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueSdM === null || valueSdM === undefined ? valueSdM : sdMToPerm(valueSdM),
        "perm",
        { fractionDigits: 3, ...options },
      )
    : formatNumberWithUnit(valueSdM, "m", { fractionDigits: 2, ...options });
}

export function parseVaporSd(input: string, options: UnitFormatOptions): UnitParseResult {
  if (options.unitSystem === "IP" && isPositiveInfinity(input)) {
    return { ok: true, valueSi: 0 };
  }
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter vapor permeance." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0 || (options.unitSystem === "IP" && parsed === 0))
    return {
      ok: false,
      code: "negative",
      message:
        options.unitSystem === "IP"
          ? "Permeance must be greater than zero."
          : "Equivalent air-layer thickness cannot be negative.",
    };
  return { ok: true, valueSi: options.unitSystem === "IP" ? permToSdM(parsed) : parsed };
}

export function isPositiveInfinity(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "∞" ||
    normalized === "+∞" ||
    normalized === "infinity" ||
    normalized === "+infinity"
  );
}
