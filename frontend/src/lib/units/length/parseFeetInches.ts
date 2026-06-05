// Architectural feet-inches parser. Returns decimal inches.
//
// Supported forms:
//   2'           → 24      (feet only)
//   6"           → 6       (inches only)
//   2' 6"        → 30      (feet + inches)
//   2'6"         → 30      (no space)
//   3'-4"        → 40      (dash separator)
//   6-1/2"       → 6.5     (whole + fraction with dash)
//   2' 6-1/2"    → 30.5    (feet + whole + fraction)
//   1/2"         → 0.5     (pure fraction)
//   24 3/8"      → 24.375  (whole + space-fraction)
//   2’ / 6”   → smart-quote variants normalized first
//
// Returns null if the input has no feet-inches markers (`'` / `"`).
// Ported verbatim from V1, V2 style + typing.

const SMART_SINGLE_QUOTES = /[‘’`´]/g;
const SMART_DOUBLE_QUOTES = /[“”]/g;

function normalizeQuotes(input: string): string {
  return input.replace(SMART_SINGLE_QUOTES, "'").replace(SMART_DOUBLE_QUOTES, '"');
}

export function containsFeetInchesNotation(input: string): boolean {
  const normalized = normalizeQuotes(input);
  return normalized.includes("'") || normalized.includes('"');
}

function parseFraction(fraction: string): number | null {
  const match = fraction.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const numerator = parseInt(match[1]!, 10);
  const denominator = parseInt(match[2]!, 10);
  if (denominator === 0) return null;
  return numerator / denominator;
}

// "6", "6.5", "6-1/2", "6 1/2", "1/2", "24 3/8"
function parseInchesComponent(inchesStr: string): number | null {
  const trimmed = inchesStr.trim();
  if (!trimmed) return 0;

  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
    return parseFraction(trimmed);
  }
  if (/^\d+\.?\d*$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  const spaceMatch = trimmed.match(/^(\d+\.?\d*)\s+(\d+\s*\/\s*\d+)$/);
  if (spaceMatch) {
    const whole = parseFloat(spaceMatch[1]!);
    const frac = parseFraction(spaceMatch[2]!);
    if (frac !== null) return whole + frac;
  }

  const dashMatch = trimmed.match(/^(\d+\.?\d*)-(\d+\s*\/\s*\d+)$/);
  if (dashMatch) {
    const whole = parseFloat(dashMatch[1]!);
    const frac = parseFraction(dashMatch[2]!);
    if (frac !== null) return whole + frac;
  }

  return null;
}

type SectionResult = { inches: number; valid: boolean; found: boolean };

function extractFeet(normalized: string, feetMarkerIndex: number): SectionResult {
  const feetPart = normalized.substring(0, feetMarkerIndex).trim();
  const feetMatch = feetPart.match(/^(\d+\.?\d*)$/);
  if (feetMatch) return { inches: parseFloat(feetMatch[1]!) * 12, valid: true, found: true };
  if (feetPart) return { inches: 0, valid: false, found: false };
  return { inches: 0, valid: true, found: false };
}

function extractInches(
  normalized: string,
  inchesMarkerIndex: number,
  feetMarkerIndex: number,
): SectionResult {
  let inchesPart =
    feetMarkerIndex !== -1
      ? normalized.substring(feetMarkerIndex + 1, inchesMarkerIndex)
      : normalized.substring(0, inchesMarkerIndex);
  inchesPart = inchesPart.trim();
  if (inchesPart.startsWith("-")) inchesPart = inchesPart.substring(1).trim();

  if (!inchesPart) return { inches: 0, valid: true, found: false };
  const parsed = parseInchesComponent(inchesPart);
  if (parsed !== null) return { inches: parsed, valid: true, found: true };
  return { inches: 0, valid: false, found: false };
}

// Returns decimal inches, or null when input lacks `'` / `"` markers entirely.
export function parseFeetInches(input: string): number | null {
  const normalized = normalizeQuotes(input.trim());
  if (!containsFeetInchesNotation(normalized)) return null;

  let totalInches = 0;
  let hasFeet = false;
  let hasInches = false;

  const feetMarkerIndex = normalized.indexOf("'");
  const inchesMarkerIndex = normalized.indexOf('"');

  if (feetMarkerIndex !== -1) {
    const feet = extractFeet(normalized, feetMarkerIndex);
    if (!feet.valid) return null;
    totalInches += feet.inches;
    hasFeet = feet.found;
  }

  if (inchesMarkerIndex !== -1) {
    const inches = extractInches(normalized, inchesMarkerIndex, feetMarkerIndex);
    if (!inches.valid) return null;
    totalInches += inches.inches;
    hasInches = inches.found;
  }

  return hasFeet || hasInches ? totalInches : null;
}
