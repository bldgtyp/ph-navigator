export function formatNumber(value: number | null): string {
  return value === null ? "" : String(value);
}
