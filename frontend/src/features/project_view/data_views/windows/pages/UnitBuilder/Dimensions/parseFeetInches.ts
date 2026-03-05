/**
 * Parse architectural feet-inches notation into decimal inches.
 *
 * Supported formats:
 *   `2'`        → 24     (feet only)
 *   `6"`        → 6      (inches only)
 *   `2' 6"`     → 30     (feet and inches)
 *   `2'6"`      → 30     (feet and inches, no space)
 *   `3'-4"`     → 40     (feet-inches with dash)
 *   `6-1/2"`    → 6.5    (inches with fraction)
 *   `2' 6-1/2"` → 30.5   (feet, inches, and fraction)
 *   `1/2"`      → 0.5    (fraction only)
 *   `24 3/8"`   → 24.375 (whole inches with fraction)
 *
 * Returns null if input is not feet-inches notation.
 */

/** Normalize curly/smart quotes to straight quotes. */
function normalizeQuotes(input: string): string {
    return input
        .replace(/[\u2018\u2019\u0060\u00B4]/g, "'") // Various single quotes → '
        .replace(/[\u201C\u201D]/g, '"'); // Various double quotes → "
}

/** Check if the input contains feet-inches notation markers (' or "). */
export function containsFeetInchesNotation(input: string): boolean {
    const normalized = normalizeQuotes(input);
    return normalized.includes("'") || normalized.includes('"');
}

/** Parse a fraction string like "1/2" or "3/8" into a decimal. */
function parseFraction(fraction: string): number | null {
    const match = fraction.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;

    const numerator = parseInt(match[1], 10);
    const denominator = parseInt(match[2], 10);

    if (denominator === 0) return null;
    return numerator / denominator;
}

type ParseSectionResult = {
    inches: number;
    valid: boolean;
    found: boolean;
};

/**
 * Parse an inches component that may include a fraction.
 * Examples: "6", "6.5", "6-1/2", "6 1/2", "1/2", "24 3/8"
 */
function parseInchesComponent(inchesStr: string): number | null {
    const trimmed = inchesStr.trim();
    if (!trimmed) return 0;

    // Pure fraction: "1/2"
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
        return parseFraction(trimmed);
    }

    // Decimal number: "6.5" or "6"
    if (/^\d+\.?\d*$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    // Whole number with space-separated fraction: "24 3/8"
    const spaceMatch = trimmed.match(/^(\d+\.?\d*)\s+(\d+\s*\/\s*\d+)$/);
    if (spaceMatch) {
        const whole = parseFloat(spaceMatch[1]);
        const frac = parseFraction(spaceMatch[2]);
        if (frac !== null) return whole + frac;
    }

    // Compound fraction with dash: "6-1/2"
    const dashMatch = trimmed.match(/^(\d+\.?\d*)-(\d+\s*\/\s*\d+)$/);
    if (dashMatch) {
        const whole = parseFloat(dashMatch[1]);
        const frac = parseFraction(dashMatch[2]);
        if (frac !== null) return whole + frac;
    }

    return null;
}

/** Extract and parse feet from normalized input. Returns { inches, valid, found }. */
function extractFeet(normalized: string, feetMarkerIndex: number): ParseSectionResult {
    const feetPart = normalized.substring(0, feetMarkerIndex).trim();
    const feetMatch = feetPart.match(/^(\d+\.?\d*)$/);

    if (feetMatch) {
        return { inches: parseFloat(feetMatch[1]) * 12, valid: true, found: true };
    }
    // Non-empty but unparseable feet part is invalid
    if (feetPart) {
        return { inches: 0, valid: false, found: false };
    }
    // Empty feet part (marker at start) is valid but contributes 0
    return { inches: 0, valid: true, found: false };
}

/** Extract and parse inches from normalized input. Returns { inches, valid, found }. */
function extractInches(normalized: string, inchesMarkerIndex: number, feetMarkerIndex: number): ParseSectionResult {
    let inchesPart: string;
    if (feetMarkerIndex !== -1) {
        inchesPart = normalized.substring(feetMarkerIndex + 1, inchesMarkerIndex);
    } else {
        inchesPart = normalized.substring(0, inchesMarkerIndex);
    }

    // Clean up: remove leading dash or spaces (separator after feet)
    inchesPart = inchesPart.trim();
    if (inchesPart.startsWith('-')) {
        inchesPart = inchesPart.substring(1).trim();
    }

    if (!inchesPart) {
        return { inches: 0, valid: true, found: false };
    }

    const parsed = parseInchesComponent(inchesPart);
    if (parsed !== null) {
        return { inches: parsed, valid: true, found: true };
    }
    return { inches: 0, valid: false, found: false };
}

/**
 * Parse feet-inches notation into decimal inches.
 * Returns null if the input is not valid feet-inches notation.
 */
export function parseFeetInches(input: string): number | null {
    const normalized = normalizeQuotes(input.trim());

    if (!containsFeetInchesNotation(normalized)) {
        return null;
    }

    let totalInches = 0;
    let hasFeet = false;
    let hasInches = false;

    const feetMarkerIndex = normalized.indexOf("'");
    const inchesMarkerIndex = normalized.indexOf('"');

    // Parse feet if present
    if (feetMarkerIndex !== -1) {
        const feet = extractFeet(normalized, feetMarkerIndex);
        if (!feet.valid) return null;
        totalInches += feet.inches;
        hasFeet = feet.found;
    }

    // Parse inches if present
    if (inchesMarkerIndex !== -1) {
        const inches = extractInches(normalized, inchesMarkerIndex, feetMarkerIndex);
        if (!inches.valid) return null;
        totalInches += inches.inches;
        hasInches = inches.found;
    }

    // Must have parsed at least feet or inches
    if (hasFeet || hasInches) {
        return totalInches;
    }

    return null;
}
