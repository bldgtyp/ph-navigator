export const MIN_NUMBER_PRECISION = 0;
export const MAX_NUMBER_PRECISION = 10;
export const DEFAULT_NUMBER_PRECISION = 2;

export function clampNumberPrecision(value: unknown): number {
  const parsed = typeof value === "number" ? Math.trunc(value) : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_NUMBER_PRECISION;
  return Math.min(Math.max(parsed, MIN_NUMBER_PRECISION), MAX_NUMBER_PRECISION);
}
