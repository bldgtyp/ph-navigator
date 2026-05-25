// Plan-13 §4.1 / R1 mitigation: typed accessors for custom-field
// values. Render code must NEVER touch `row.custom[id]` directly —
// always go through these helpers so the `cf_*` identity rule is the
// only path into custom values.
import type { FieldDef } from "../types";

export const CUSTOM_FIELD_KEY_PREFIX = "cf_";

export function isCustomFieldKey(fieldKey: string | undefined | null): fieldKey is string {
  return typeof fieldKey === "string" && fieldKey.startsWith(CUSTOM_FIELD_KEY_PREFIX);
}

export function getCustomValue(
  row: { custom?: Record<string, unknown> | null | undefined },
  fieldDef: Pick<FieldDef, "field_key">,
): unknown {
  if (!isCustomFieldKey(fieldDef.field_key)) return undefined;
  return row.custom?.[fieldDef.field_key];
}

export function setCustomValue<TRow extends { custom?: Record<string, unknown> | null | undefined }>(
  row: TRow,
  fieldDef: Pick<FieldDef, "field_key">,
  value: unknown,
): TRow {
  if (!isCustomFieldKey(fieldDef.field_key)) {
    throw new Error(`setCustomValue called with non-custom field_key: ${fieldDef.field_key}`);
  }
  const next: Record<string, unknown> = { ...(row.custom ?? {}) };
  if (value === undefined) delete next[fieldDef.field_key];
  else next[fieldDef.field_key] = value;
  return { ...row, custom: next };
}
