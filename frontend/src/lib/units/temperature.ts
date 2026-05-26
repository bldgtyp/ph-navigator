import { formatNumberWithUnit, parseDecimalInput } from "./format";
import type { UnitFormatOptions, UnitParseResult } from "./types";

export function cToF(valueC: number): number {
  return valueC * (9 / 5) + 32;
}

export function fToC(valueF: number): number {
  return (valueF - 32) * (5 / 9);
}

export function formatTemperatureFromC(
  valueC: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueC === null || valueC === undefined ? valueC : cToF(valueC), "deg F", {
        fractionDigits: 1,
        ...options,
      })
    : formatNumberWithUnit(valueC, "deg C", { fractionDigits: 1, ...options });
}

export function parseTemperatureToC(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter temperature." };
  if (Number.isNaN(parsed)) return { ok: false, code: "invalid_number", message: "Enter a number." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? fToC(parsed) : parsed };
}
