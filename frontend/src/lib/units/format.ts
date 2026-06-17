import type { UnitFormatOptions } from "./types";

export function formatNumberWithUnit(
  value: number | null | undefined,
  unit: string,
  options: UnitFormatOptions,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options.empty ?? "—";
  }
  const fractionDigits = options.fractionDigits ?? 2;
  const formatted = stripTrailingZeros(value.toFixed(fractionDigits));
  return options.showUnit === false || unit === "" ? formatted : `${formatted} ${unit}`;
}

export function parseDecimalInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseNumberInput(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stripTrailingZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
