import { formatNumberWithUnit, parseDecimalInput } from "./format";
import type { UnitFormatOptions, UnitParseResult } from "./types";

const MM_PER_IN = 25.4;
const MM_PER_FT = 304.8;
const FT2_PER_M2 = 10.7639104167;
const FT3_PER_M3 = 35.3146667215;

export function mmToIn(valueMm: number): number {
  return valueMm / MM_PER_IN;
}

export function inToMm(valueIn: number): number {
  return valueIn * MM_PER_IN;
}

export function mmToFt(valueMm: number): number {
  return valueMm / MM_PER_FT;
}

export function ftToMm(valueFt: number): number {
  return valueFt * MM_PER_FT;
}

export function m2ToFt2(valueM2: number): number {
  return valueM2 * FT2_PER_M2;
}

export function ft2ToM2(valueFt2: number): number {
  return valueFt2 / FT2_PER_M2;
}

export function m3ToFt3(valueM3: number): number {
  return valueM3 * FT3_PER_M3;
}

export function ft3ToM3(valueFt3: number): number {
  return valueFt3 / FT3_PER_M3;
}

export function formatLengthFromMm(
  valueMm: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueMm === null || valueMm === undefined ? valueMm : mmToIn(valueMm), "in", {
        fractionDigits: 2,
        ...options,
      })
    : formatNumberWithUnit(valueMm, "mm", { fractionDigits: 1, ...options });
}

export function parseLengthToMm(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter a length." };
  if (Number.isNaN(parsed)) return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "Length cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? inToMm(parsed) : parsed };
}

export function formatAreaFromM2(
  valueM2: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueM2 === null || valueM2 === undefined ? valueM2 : m2ToFt2(valueM2), "ft2", {
        fractionDigits: 2,
        ...options,
      })
    : formatNumberWithUnit(valueM2, "m2", { fractionDigits: 2, ...options });
}

export function formatVolumeFromM3(
  valueM3: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueM3 === null || valueM3 === undefined ? valueM3 : m3ToFt3(valueM3), "ft3", {
        fractionDigits: 2,
        ...options,
      })
    : formatNumberWithUnit(valueM3, "m3", { fractionDigits: 2, ...options });
}
