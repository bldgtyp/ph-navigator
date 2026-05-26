// Shared field-default readers used by `buildEmpty*Row` factories.
// They preserve `null` (an explicit clear), accept the source-typed
// value, and otherwise fall back to the row's natural zero — silent
// coercion (`String(...)` / `Number(...)`) would otherwise turn the
// `undefined` of an unset `fieldDefaults` key into the literal string
// "undefined" or `NaN`.

export function readStringDefault(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

export function readNumberDefault(value: unknown, fallback: number | null): number | null {
  return value === null || typeof value === "number" ? value : fallback;
}
