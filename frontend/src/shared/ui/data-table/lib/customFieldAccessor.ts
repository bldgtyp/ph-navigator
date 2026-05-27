// Typed accessors for FieldDef-backed row values stored in the backend
// `custom_values` bag. Render code MUST go through these helpers so the
// storage key rule has a single enforced entry point.
import type { FieldDef } from "../types";

export const CUSTOM_FIELD_KEY_PREFIX = "cf_";
type FieldKeyRef = Pick<FieldDef, "field_key"> | string;

export function isCustomFieldKey(fieldKey: string | undefined | null): fieldKey is string {
  return typeof fieldKey === "string" && fieldKey.startsWith(CUSTOM_FIELD_KEY_PREFIX);
}

export function getCustomValue(
  row: { custom_values?: Record<string, unknown> | null | undefined },
  fieldDef: FieldKeyRef,
): unknown {
  return row.custom_values?.[fieldKeyOf(fieldDef)];
}

export function setCustomValue<
  TRow extends { custom_values?: Record<string, unknown> | null | undefined },
>(row: TRow, fieldDef: FieldKeyRef, value: unknown): TRow {
  const fieldKey = fieldKeyOf(fieldDef);
  const current = row.custom_values?.[fieldKey];
  if (value === undefined && current === undefined) return row;
  if (value !== undefined && Object.is(current, value)) return row;

  const next: Record<string, unknown> = { ...(row.custom_values ?? {}) };
  if (value === undefined) delete next[fieldKey];
  else next[fieldKey] = value;
  return { ...row, custom_values: next };
}

function fieldKeyOf(fieldDef: FieldKeyRef): string {
  return typeof fieldDef === "string" ? fieldDef : fieldDef.field_key;
}
