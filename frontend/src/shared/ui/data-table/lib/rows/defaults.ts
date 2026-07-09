import { parseNumberUnitsInput, type UnitSystem } from "../../../../../lib/units";
import { generatedId } from "../../../../lib/ids";
import type {
  BuildEmptyRow,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  FieldType,
  RowInsertPayload,
} from "../../types";
import { normalizeColorInput } from "../../../../lib/color";
import { createFieldOption } from "../options/create";
import { canEditFieldOptions } from "../options/mutability";
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

export function planEmptyRows<TRow>({
  count,
  fieldDefs,
  buildEmptyRow,
  generateRowId,
  anchorRow = null,
  anchorRowId = null,
}: {
  count: number;
  fieldDefs: FieldDef[];
  buildEmptyRow: BuildEmptyRow<TRow>;
  generateRowId?: () => string;
  anchorRow?: TRow | null;
  anchorRowId?: string | null;
}): { rows: TRow[]; inserts: RowInsertPayload[] } {
  const baseDefaults = buildEmptyRowDefaults(fieldDefs);
  const inserts: RowInsertPayload[] = [];
  const rows: TRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const rowId = generateRowId?.() ?? `tmp_${generatedId("row")}`;
    const fieldDefaults = { ...baseDefaults };
    inserts.push({ rowId, fieldDefaults, anchorRowId });
    rows.push(buildEmptyRow({ rowId, fieldDefaults, anchorRow }));
  }
  return { rows, inserts };
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
  {
    emptyNumberValue = null,
    unitSystem = "SI",
  }: { emptyNumberValue?: number | null; unitSystem?: UnitSystem } = {},
): { ok: true; value: unknown; created?: FieldOption } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (fieldDef?.field_type === "number") {
    if (!trimmed && !fieldAllowsNull(fieldDef)) {
      return { ok: false, message: "Value required." };
    }
    if (!trimmed) return { ok: true, value: emptyNumberValue };
    if (fieldDef.numberUnits) {
      const parsed = parseNumberUnitsInput(raw, fieldDef.numberUnits, unitSystem);
      if (parsed === undefined) return { ok: false, message: "Expected a number." };
      return { ok: true, value: parsed };
    }
    const value = Number(trimmed);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: "Expected a number." };
  }
  if (fieldDef?.field_type === "single_select") {
    if (!trimmed && !fieldAllowsNull(fieldDef)) {
      return { ok: false, message: "Value required." };
    }
    if (!trimmed) return { ok: true, value: null };
    const options = optionsForField();
    const existing = findFieldOptionByLabel(options, trimmed);
    if (existing) return { ok: true, value: existing.id };
    if (!canEditFieldOptions(fieldDef)) {
      return { ok: false, message: `${fieldDef.display_name} does not allow new options.` };
    }
    const created = createFieldOption(trimmed, options);
    options.push(created);
    return { ok: true, value: created.id, created };
  }
  if (fieldDef?.field_type === "color") {
    if (!trimmed && !fieldAllowsNull(fieldDef)) {
      return { ok: false, message: "Value required." };
    }
    if (!trimmed) return { ok: true, value: null };
    const normalized = normalizeColorInput(trimmed);
    return normalized
      ? { ok: true, value: normalized }
      : { ok: false, message: "Expected a hex, RGB, or CMYK color." };
  }
  if (fieldDef?.field_type === "text") {
    if (!trimmed && !fieldAllowsNull(fieldDef)) {
      return { ok: false, message: "Value required." };
    }
    if (!trimmed && fieldAllowsNull(fieldDef)) return { ok: true, value: null };
  }
  if (fieldDef?.field_type === "linked_record") {
    return coerceLinkedRecordPaste(trimmed, fieldDef);
  }
  return { ok: true, value: raw };
}

// Linked-record paste accepts the JSON-serialized id list emitted by
// `formatClipboardValue` (copy from a sibling linked_record cell) and
// rejects any other shape — including stringified pill text
// ("Pump A, Pump B") which would silently corrupt the `custom_links`
// bag (PRD §11 Q24). An empty paste clears the cell.
function coerceLinkedRecordPaste(
  trimmed: string,
  fieldDef: FieldDef,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (!trimmed) return { ok: true, value: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "Expected a JSON list of linked-record ids." };
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    return { ok: false, message: "Expected a JSON list of linked-record ids." };
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of parsed) {
    if (entry.length === 0 || seen.has(entry)) continue;
    seen.add(entry);
    ids.push(entry);
  }
  const maxLinks = fieldDef.linked_record_config?.max_links;
  if (typeof maxLinks === "number" && ids.length > maxLinks) {
    return {
      ok: false,
      message: `${fieldDef.display_name} accepts at most ${maxLinks} link${maxLinks === 1 ? "" : "s"}.`,
    };
  }
  return { ok: true, value: ids };
}

export function fieldAllowsNull(fieldDef: FieldDef | undefined): boolean {
  return fieldDef?.required !== true;
}
