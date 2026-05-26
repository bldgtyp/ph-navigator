import type { FieldOption } from "../../types";
import { normalizeOptionLabel } from "./create";

export function findFieldOptionByLabel(
  options: FieldOption[],
  rawLabel: string,
): FieldOption | undefined {
  const label = normalizeOptionLabel(rawLabel);
  return options.find((option) => normalizeOptionLabel(option.label) === label);
}

export function hasDuplicateFieldOptionLabels(options: FieldOption[]): boolean {
  const labels = new Set<string>();
  for (const option of options) {
    const label = normalizeOptionLabel(option.label);
    if (!label) continue;
    if (labels.has(label)) return true;
    labels.add(label);
  }
  return false;
}

// Counts how many rows reference each option id, read through the
// supplied accessor. The accessor makes this row-shape-agnostic so any
// DataTable consumer can reuse it without knowing the row type.
export function optionReferenceCounts<TRow>(
  rows: readonly TRow[],
  accessor: (row: TRow) => unknown,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

// Returns the option ids referenced by ≥1 row that are NOT present in
// the supplied options list. Used by the field-config options section to surface
// a "N rows reference unknown options" warning.
export function missingOptionReferences<TRow>(
  rows: readonly TRow[],
  options: readonly FieldOption[],
  accessor: (row: TRow) => unknown,
): string[] {
  const validIds = new Set(options.map((option) => option.id));
  const missing = new Set<string>();
  for (const row of rows) {
    const value = accessor(row);
    if (typeof value !== "string" || !value) continue;
    if (!validIds.has(value)) missing.add(value);
  }
  return [...missing];
}
