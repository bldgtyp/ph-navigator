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
    ? formatNumberWithUnit(
        valueMm === null || valueMm === undefined ? valueMm : mmToIn(valueMm),
        "in",
        {
          fractionDigits: 2,
          ...options,
        },
      )
    : formatNumberWithUnit(valueMm, "mm", { fractionDigits: 1, ...options });
}

export function parseLengthToMm(input: string, options: UnitFormatOptions): UnitParseResult {
  const unitParse = parseLengthInput(input);
  if (unitParse === null) return { ok: false, code: "empty", message: "Enter a length." };
  if (!unitParse.ok) return unitParse.error;

  const parsed = unitParse.value;
  if (parsed === null) return { ok: false, code: "empty", message: "Enter a length." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "Length cannot be negative." };

  switch (unitParse.unit) {
    case "mm":
      return { ok: true, valueSi: parsed };
    case "cm":
      return { ok: true, valueSi: parsed * 10 };
    case "m":
      return { ok: true, valueSi: parsed * 1000 };
    case "in":
      return { ok: true, valueSi: inToMm(parsed) };
    case "ft":
      return { ok: true, valueSi: ftToMm(parsed) };
    case null:
      return { ok: true, valueSi: options.unitSystem === "IP" ? inToMm(parsed) : parsed };
  }
}

type LengthInputUnit = "mm" | "cm" | "m" | "in" | "ft";

type LengthInputParse =
  | { ok: true; value: number | null; unit: LengthInputUnit | null }
  | { ok: false; error: UnitParseResult };

function parseLengthInput(input: string): LengthInputParse | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") return null;

  const trailingUnitMatch = trimmed.match(/([a-z"']+)\s*$/u);
  const unitMatch = trimmed.match(
    /\s*(mm|millimeters?|cm|centimeters?|m|meters?|in|inch|inches|"|ft|feet|foot|')\s*$/u,
  );
  const unit = normalizeLengthUnit(unitMatch?.[1] ?? null);
  if (trailingUnitMatch && !unitMatch) {
    return {
      ok: false,
      error: { ok: false, code: "unsupported_unit", message: "Unsupported length unit." },
    };
  }

  const rawNumber = (unitMatch ? trimmed.slice(0, unitMatch.index).trim() : trimmed).replace(
    /,/gu,
    "",
  );
  const parsed =
    unit === "in" || unit === null ? parseInchLikeNumber(rawNumber) : parseDecimalInput(rawNumber);
  return { ok: true, value: parsed, unit };
}

function normalizeLengthUnit(unit: string | null): LengthInputUnit | null {
  if (unit === null) return null;
  if (unit === "mm" || unit.startsWith("millimeter")) return "mm";
  if (unit === "cm" || unit.startsWith("centimeter")) return "cm";
  if (unit === "m" || unit.startsWith("meter")) return "m";
  if (unit === "in" || unit === "inch" || unit === "inches" || unit === '"') return "in";
  if (unit === "ft" || unit === "feet" || unit === "foot" || unit === "'") return "ft";
  return null;
}

function parseInchLikeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const mixedFraction = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/u);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    if (!Number.isFinite(whole) || denominator === 0) return Number.NaN;
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (numerator / denominator);
  }

  const fraction = trimmed.match(/^([+-]?\d+)\s*\/\s*(\d+)$/u);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator === 0) return Number.NaN;
    return numerator / denominator;
  }

  return parseDecimalInput(trimmed);
}

export function formatAreaFromM2(
  valueM2: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueM2 === null || valueM2 === undefined ? valueM2 : m2ToFt2(valueM2),
        "ft2",
        {
          fractionDigits: 2,
          ...options,
        },
      )
    : formatNumberWithUnit(valueM2, "m2", { fractionDigits: 2, ...options });
}

export function formatVolumeFromM3(
  valueM3: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueM3 === null || valueM3 === undefined ? valueM3 : m3ToFt3(valueM3),
        "ft3",
        {
          fractionDigits: 2,
          ...options,
        },
      )
    : formatNumberWithUnit(valueM3, "m3", { fractionDigits: 2, ...options });
}
