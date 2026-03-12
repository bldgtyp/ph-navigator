/**
 * Format a value in millimeters as an architectural feet-inches string.
 *
 * Examples:
 *   304.8  → `1'`
 *   152.4  → `6"`
 *   927.1  → `3' 0-1/2"`
 *   1168.4 → `3' 10"`
 *   1181.1 → `3' 10-1/2"`
 */

const FRACTION_DENOMINATOR = 16;

/** Snap a fractional value to the nearest 1/16 and return reduced [numerator, denominator]. */
function snapToFraction(fractional: number): [number, number] {
    const numerator = Math.round(fractional * FRACTION_DENOMINATOR);
    if (numerator === 0 || numerator === FRACTION_DENOMINATOR) {
        return [numerator, FRACTION_DENOMINATOR];
    }
    let n = numerator;
    let d = FRACTION_DENOMINATOR;
    while (n % 2 === 0 && d % 2 === 0) {
        n /= 2;
        d /= 2;
    }
    return [n, d];
}

/** Build the inches portion string (e.g. `6-1/2"`). Returns empty string if no inches. */
function buildInchesPart(wholeInches: number, fracNum: number, fracDen: number): string {
    if (wholeInches > 0 && fracNum > 0) {
        return `${wholeInches}-${fracNum}/${fracDen}"`;
    }
    if (wholeInches > 0) {
        return `${wholeInches}"`;
    }
    if (fracNum > 0) {
        return `${fracNum}/${fracDen}"`;
    }
    return '';
}

/** Carry fractional overflow into whole inches and feet. */
function carryOverflow(
    feet: number,
    inches: number,
    fracNum: number,
    fracDen: number
): { feet: number; inches: number; fracNum: number; fracDen: number } {
    if (fracNum === FRACTION_DENOMINATOR) {
        inches += 1;
        fracNum = 0;
    }
    if (inches >= 12) {
        inches -= 12;
        feet += 1;
    }
    return { feet, inches, fracNum, fracDen };
}

export function formatFeetInches(valueMM: number): string {
    const totalInches = valueMM / 25.4;
    const negative = totalInches < 0;
    const absInches = Math.abs(totalInches);

    const rawFeet = Math.floor(absInches / 12);
    const rawWholeInches = Math.floor(absInches - rawFeet * 12);
    const fractional = absInches - rawFeet * 12 - rawWholeInches;
    const [rawFracNum, rawFracDen] = snapToFraction(fractional);

    const { feet, inches, fracNum, fracDen } = carryOverflow(rawFeet, rawWholeInches, rawFracNum, rawFracDen);

    const prefix = negative ? '-' : '';
    const inchesPart = buildInchesPart(inches, fracNum, fracDen);

    if (feet > 0 && inchesPart) {
        return `${prefix}${feet}' ${inchesPart}`;
    }
    if (feet > 0) {
        return `${prefix}${feet}'`;
    }
    if (inchesPart) {
        return `${prefix}${inchesPart}`;
    }
    return '0"';
}
