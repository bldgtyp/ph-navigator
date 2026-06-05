// Format mm as an architectural feet-inches string. Rounds to the nearest
// 1/16" and reduces the fraction to lowest terms. Mirrors V1 verbatim.

const FRACTION_DENOMINATOR = 16;
const MM_PER_IN = 25.4;

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

function buildInchesPart(wholeInches: number, fracNum: number, fracDen: number): string {
  if (wholeInches > 0 && fracNum > 0) return `${wholeInches}-${fracNum}/${fracDen}"`;
  if (wholeInches > 0) return `${wholeInches}"`;
  if (fracNum > 0) return `${fracNum}/${fracDen}"`;
  return "";
}

function carryOverflow(
  feet: number,
  inches: number,
  fracNum: number,
  fracDen: number,
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

// `format` selects between full architectural ("ft-in", e.g. `2' 6-1/2"`)
// and fractional inches only ("in-frac", e.g. `30-1/2"`).
export function formatFeetInches(valueMm: number, format: "ft-in" | "in-frac" = "ft-in"): string {
  const totalInches = valueMm / MM_PER_IN;
  const negative = totalInches < 0;
  const absInches = Math.abs(totalInches);

  if (format === "in-frac") {
    const wholeRaw = Math.floor(absInches);
    const fractional = absInches - wholeRaw;
    const [rawNum, rawDen] = snapToFraction(fractional);
    let whole = wholeRaw;
    let num = rawNum;
    if (num === FRACTION_DENOMINATOR) {
      whole += 1;
      num = 0;
    }
    const part = buildInchesPart(whole, num, rawDen);
    if (!part) return '0"';
    return negative ? `-${part}` : part;
  }

  const rawFeet = Math.floor(absInches / 12);
  const rawWholeInches = Math.floor(absInches - rawFeet * 12);
  const fractional = absInches - rawFeet * 12 - rawWholeInches;
  const [rawFracNum, rawFracDen] = snapToFraction(fractional);

  const { feet, inches, fracNum, fracDen } = carryOverflow(
    rawFeet,
    rawWholeInches,
    rawFracNum,
    rawFracDen,
  );

  const prefix = negative ? "-" : "";
  const inchesPart = buildInchesPart(inches, fracNum, fracDen);

  if (feet > 0 && inchesPart) return `${prefix}${feet}' ${inchesPart}`;
  if (feet > 0) return `${prefix}${feet}'`;
  if (inchesPart) return `${prefix}${inchesPart}`;
  return '0"';
}
