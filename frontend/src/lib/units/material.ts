import { formatNumberWithUnit, parseDecimalInput } from "./format";
import type { UnitFormatOptions, UnitParseResult } from "./types";

const LB_FT3_PER_KG_M3 = 0.06242796;
const BTU_LB_F_PER_J_KG_K = 0.0002388458966275;

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
  if (Number.isNaN(parsed)) return { ok: false, code: "invalid_number", message: "Enter a number." };
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

export function parseSpecificHeatToJKgK(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter specific heat." };
  if (Number.isNaN(parsed)) return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "Specific heat cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? btuLbFToJKgK(parsed) : parsed };
}
