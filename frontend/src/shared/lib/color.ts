export type RgbColor = { r: number; g: number; b: number };
export type CmykColor = { c: number; m: number; y: number; k: number };

const HEX_6_PATTERN = /^#[0-9a-fA-F]{6}$/;
const HEX_3_PATTERN = /^#[0-9a-fA-F]{3}$/;
const RGB_FUNCTION_PATTERN =
  /^rgba?\(\s*(\d{1,3})(?:\s*,\s*|\s+)(\d{1,3})(?:\s*,\s*|\s+)(\d{1,3})(?:\s*[,/]\s*(?:0|1|0?\.\d+|100%))?\s*\)$/i;
const CMYK_FUNCTION_PATTERN =
  /^cmyk\(\s*(\d{1,3})(?:%?\s*,\s*|%?\s+)(\d{1,3})(?:%?\s*,\s*|%?\s+)(\d{1,3})(?:%?\s*,\s*|%?\s+)(\d{1,3})%?\s*\)$/i;

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const stored = normalizeStoredHexColor(trimmed);
  if (stored) return stored;
  if (!HEX_3_PATTERN.test(trimmed)) return null;
  const r = trimmed[1] ?? "";
  const g = trimmed[2] ?? "";
  const b = trimmed[3] ?? "";
  return `#${r}${r}${g}${g}${b}${b}`.toLocaleLowerCase();
}

export function normalizeStoredHexColor(value: string): string | null {
  const trimmed = value.trim();
  return HEX_6_PATTERN.test(trimmed) ? trimmed.toLocaleLowerCase() : null;
}

export function normalizeColorInput(value: string): string | null {
  const hex = normalizeHexColor(value);
  if (hex) return hex;
  const rgb = parseRgbInput(value);
  if (rgb) return rgbToHex(rgb);
  const cmyk = parseCmykInput(value);
  if (cmyk) return cmykToHex(cmyk);
  return null;
}

export function colorToCss(value: string | null | undefined, fallback = "transparent"): string {
  const normalized = typeof value === "string" ? normalizeHexColor(value) : null;
  return normalized ?? fallback;
}

export function hexToRgb(value: string | null | undefined): RgbColor | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string | null {
  if (!isByte(r) || !isByte(g) || !isByte(b)) return null;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

export function cmykToHex({ c, m, y, k }: CmykColor): string | null {
  if (![c, m, y, k].every(isPercent)) return null;
  const cRatio = c / 100;
  const mRatio = m / 100;
  const yRatio = y / 100;
  const kRatio = k / 100;
  return rgbToHex({
    r: Math.round(255 * (1 - cRatio) * (1 - kRatio)),
    g: Math.round(255 * (1 - mRatio) * (1 - kRatio)),
    b: Math.round(255 * (1 - yRatio) * (1 - kRatio)),
  });
}

export function rgbToCmyk({ r, g, b }: RgbColor): CmykColor | null {
  if (!isByte(r) || !isByte(g) || !isByte(b)) return null;
  const rRatio = r / 255;
  const gRatio = g / 255;
  const bRatio = b / 255;
  const kRatio = 1 - Math.max(rRatio, gRatio, bRatio);
  if (kRatio === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: roundPercent(((1 - rRatio - kRatio) / (1 - kRatio)) * 100),
    m: roundPercent(((1 - gRatio - kRatio) / (1 - kRatio)) * 100),
    y: roundPercent(((1 - bRatio - kRatio) / (1 - kRatio)) * 100),
    k: roundPercent(kRatio * 100),
  };
}

function parseRgbInput(value: string): RgbColor | null {
  const match = value.trim().match(RGB_FUNCTION_PATTERN);
  if (!match) return null;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  return isByte(r) && isByte(g) && isByte(b) ? { r, g, b } : null;
}

function parseCmykInput(value: string): CmykColor | null {
  const match = value.trim().match(CMYK_FUNCTION_PATTERN);
  if (!match) return null;
  const c = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  const k = Number(match[4]);
  return [c, m, y, k].every(isPercent) ? { c, m, y, k } : null;
}

function isByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function isPercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}
