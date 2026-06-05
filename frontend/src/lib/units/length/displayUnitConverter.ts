// mm ↔ display-unit conversion. Display-format-driven decimal precision
// mirrors V1. Used by the apertures dimension labels + total caption.

import { formatFeetInches } from "./formatFeetInches";
import type { DisplayFormat } from "./types";

const MM_PER_CM = 10;
const MM_PER_M = 1000;
const MM_PER_IN = 25.4;
const MM_PER_FT = 304.8;

type NumericConfig = { decimals: number; toDisplay: (valueMm: number) => number };

const NUMERIC_FORMAT: Record<Exclude<DisplayFormat, "ft-in" | "in-frac">, NumericConfig> = {
  mm: { decimals: 1, toDisplay: (v) => v },
  cm: { decimals: 2, toDisplay: (v) => v / MM_PER_CM },
  m: { decimals: 4, toDisplay: (v) => v / MM_PER_M },
  in: { decimals: 2, toDisplay: (v) => v / MM_PER_IN },
  ft: { decimals: 3, toDisplay: (v) => v / MM_PER_FT },
};

// Format a mm value for display in the given format.
//   `decimals` overrides the per-format default.
//   `ft-in` / `in-frac` ignore `decimals` (rounding is by 1/16").
export function formatValueForDisplay(
  valueMm: number,
  format: DisplayFormat,
  decimals?: number,
): string {
  if (format === "ft-in") return formatFeetInches(valueMm, "ft-in");
  if (format === "in-frac") return formatFeetInches(valueMm, "in-frac");
  const config = NUMERIC_FORMAT[format];
  const dec = decimals ?? config.decimals;
  return config.toDisplay(valueMm).toFixed(dec);
}

// Display-unit → mm. Used internally by `parseToMm`; tests exercise it
// directly to lock the round-trip behavior.
export function convertDisplayValueToMm(value: number, format: DisplayFormat): number {
  switch (format) {
    case "mm":
      return value;
    case "cm":
      return value * MM_PER_CM;
    case "m":
      return value * MM_PER_M;
    case "in":
    case "in-frac":
      return value * MM_PER_IN;
    case "ft":
      return value * MM_PER_FT;
    case "ft-in":
      // ft-in fields always parse through parseFeetInches → inches; callers
      // shouldn't reach this branch via a plain number, but if they do we
      // treat the value as inches (V1 behavior).
      return value * MM_PER_IN;
  }
}
