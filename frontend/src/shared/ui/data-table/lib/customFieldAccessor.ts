// Typed accessors for custom-field row values. Render code MUST go
// through these helpers — never read `row.custom[id]` directly — so the
// `cf_*` identity rule has a single enforced entry point.
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

export function setCustomValue<
  TRow extends { custom?: Record<string, unknown> | null | undefined },
>(row: TRow, fieldDef: Pick<FieldDef, "field_key">, value: unknown): TRow {
  if (!isCustomFieldKey(fieldDef.field_key)) {
    throw new Error(`setCustomValue called with non-custom field_key: ${fieldDef.field_key}`);
  }
  const next: Record<string, unknown> = { ...(row.custom ?? {}) };
  if (value === undefined) delete next[fieldDef.field_key];
  else next[fieldDef.field_key] = value;
  return { ...row, custom: next };
}
