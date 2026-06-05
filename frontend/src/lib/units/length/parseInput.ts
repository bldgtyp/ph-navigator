// Top-level dispatcher for dimension-input parsing. Routes to feet-inches
// or arithmetic depending on system + presence of markers, then converts
// to mm in a single step via the display-unit converter.

import { convertDisplayValueToMm } from "./displayUnitConverter";
import { evaluateSimpleExpression } from "./evaluateExpression";
import { containsFeetInchesNotation, parseFeetInches } from "./parseFeetInches";
import { isIpFormat, type DisplayFormat, type UnitSystem } from "./types";

const MM_PER_IN = 25.4;

// `parseInput` matches V1's signature for legacy callers — returns the
// parsed value in the *input* unit (inches for IP, expression-units for
// SI). Prefer `parseToMm` for new code.
export function parseInput(input: string, isIPMode: boolean): number {
  const trimmed = input.trim();
  if (!trimmed) return Number.NaN;

  if (!isIPMode) return evaluateSimpleExpression(trimmed);

  if (containsFeetInchesNotation(trimmed)) {
    const result = parseFeetInches(trimmed);
    return result ?? Number.NaN;
  }
  return evaluateSimpleExpression(trimmed);
}

// `parseToMm` is the canonical V2 entry point. Returns mm or null on
// any parse failure / non-positive result.
//
// The `format` hint chooses the conversion factor when the input is bare
// (e.g. `1.5` in `m` mode is 1500 mm). Feet-inches markers always parse
// as inches regardless of format.
export function parseToMm(input: string, system: UnitSystem, format: DisplayFormat): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (system === "ip") {
    if (containsFeetInchesNotation(trimmed)) {
      const inches = parseFeetInches(trimmed);
      if (inches === null) return null;
      const mm = inches * MM_PER_IN;
      return mm > 0 ? mm : null;
    }
    const value = evaluateSimpleExpression(trimmed);
    if (!Number.isFinite(value)) return null;
    const mm = convertDisplayValueToMm(value, isIpFormat(format) ? format : "in");
    return mm > 0 ? mm : null;
  }

  if (containsFeetInchesNotation(trimmed)) return null;
  const value = evaluateSimpleExpression(trimmed);
  if (!Number.isFinite(value)) return null;
  const mm = convertDisplayValueToMm(value, isIpFormat(format) ? "mm" : format);
  return mm > 0 ? mm : null;
}
