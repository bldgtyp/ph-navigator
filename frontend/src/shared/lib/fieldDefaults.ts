export function readStringDefault(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

export function readNumberDefault(value: unknown, fallback: number | null): number | null {
  return value === null || typeof value === "number" ? value : fallback;
}

// Resolve a new row's built-in `status` value: honor an explicit option-id
// default (from `FieldDef.default`, copied through the row-insert
// `fieldDefaults` bag), otherwise fall back to the table-wide default id.
export function readStatusDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
