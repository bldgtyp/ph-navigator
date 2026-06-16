export function readStringDefault(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

export function readNumberDefault(value: unknown, fallback: number | null): number | null {
  return value === null || typeof value === "number" ? value : fallback;
}
