import type { DataTableColumnDef, FieldDef, FieldOption, FieldType } from "../../types";
import { createFieldOption } from "../options/create";
import { findFieldOptionByLabel } from "../options/references";

// Build a fieldKey-keyed map of values cloned from the anchor row. Reads
// through column accessors so consumers stay in control of how each
// fieldKey maps to a row property. Missing column → `FieldDef.default`
// → field-type natural zero. Used by the Shift+Enter row insert flow
// (Phase 2 §4.5).
export function extractRowDefaults<TRow>(
  row: TRow,
  fieldDefs: FieldDef[],
  columns: DataTableColumnDef<TRow>[],
): Record<string, unknown> {
  const accessorByFieldKey = new Map(columns.map((column) => [column.fieldKey, column.accessor]));
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => {
      const accessor = accessorByFieldKey.get(fieldDef.field_key);
      if (accessor) return [fieldDef.field_key, accessor(row)];
      if (fieldDef.default !== undefined) return [fieldDef.field_key, fieldDef.default];
      return [fieldDef.field_key, naturalZero(fieldDef.field_type)];
    }),
  );
}

// Fallback path used when there is no anchor row (currently unreachable
// through Shift+Enter because the empty-state branch short-circuits the
// grid, but kept as a forward-compat slot for future "insert at top"
// affordances).
export function buildEmptyRowDefaults(fieldDefs: FieldDef[]): Record<string, unknown> {
  return Object.fromEntries(
    fieldDefs.map((fieldDef) => [
      fieldDef.field_key,
      fieldDef.default !== undefined ? fieldDef.default : naturalZero(fieldDef.field_type),
    ]),
  );
}

export function naturalZero(fieldType: FieldType): unknown {
  if (fieldType === "text") return "";
  if (fieldType === "number") return 0;
  return null;
}

export function coerceFieldValue(
  raw: string,
  fieldDef: FieldDef | undefined,
  optionsForField: () => FieldOption[],
  { emptyNumberValue = null }: { emptyNumberValue?: number | null } = {},
): { ok: true; value: unknown; created?: FieldOption } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (fieldDef?.field_type === "number") {
    if (!trimmed) return { ok: true, value: emptyNumberValue };
    const value = Number(trimmed);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: "Expected a number." };
  }
  if (fieldDef?.field_type === "single_select") {
    if (!trimmed) return { ok: true, value: null };
    const options = optionsForField();
    const existing = findFieldOptionByLabel(options, trimmed);
    if (existing) return { ok: true, value: existing.id };
    const created = createFieldOption(trimmed, options);
    options.push(created);
    return { ok: true, value: created.id, created };
  }
  return { ok: true, value: raw };
}
