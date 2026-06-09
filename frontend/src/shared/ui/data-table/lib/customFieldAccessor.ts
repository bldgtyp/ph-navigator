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
  row: {
    custom_values?: Record<string, unknown> | null | undefined;
    custom?: Record<string, unknown> | null | undefined;
    [key: string]: unknown;
  },
  fieldDef: FieldKeyRef,
): unknown {
  const fieldKey = fieldKeyOf(fieldDef);
  return row.custom_values?.[fieldKey] ?? row.custom?.[fieldKey] ?? row[fieldKey];
}

export function setCustomValue<
  TRow extends {
    custom_values?: Record<string, unknown> | null | undefined;
    custom_links?: Record<string, string[]> | null | undefined;
  },
>(row: TRow, fieldDef: FieldKeyRef, value: unknown): TRow {
  const fieldKey = fieldKeyOf(fieldDef);
  const current = row.custom_values?.[fieldKey];
  // §B3 — bag exclusivity: a write into `custom_values` for fieldKey
  // must clear any stale `custom_links[fieldKey]` entry the row may
  // still carry (e.g. a field that was just retyped linked_record →
  // text before the next backend refetch landed). Without this, the
  // backend rejects with `bag_exclusivity_violation` on save.
  const linksEntry = row.custom_links?.[fieldKey];
  const valueChanged = !(value === undefined && current === undefined) && !Object.is(current, value);
  if (!valueChanged && linksEntry === undefined) return row;

  let nextRow: TRow = row;
  if (valueChanged) {
    const nextValues: Record<string, unknown> = { ...(row.custom_values ?? {}) };
    if (value === undefined) delete nextValues[fieldKey];
    else nextValues[fieldKey] = value;
    nextRow = { ...nextRow, custom_values: nextValues };
  }
  if (linksEntry !== undefined) {
    const nextLinks: Record<string, string[]> = { ...(row.custom_links ?? {}) };
    delete nextLinks[fieldKey];
    nextRow = { ...nextRow, custom_links: nextLinks };
  }
  return nextRow;
}

// §B2 — Reader for linked_record cells. Prefers `custom_links` (the
// canonical bag) but falls back to a string-array entry in
// `custom_values` for rows whose data was written before the Phase 1
// bag-routing fix landed. Returns a stable empty array when neither
// bag carries an entry. The corresponding writer (`setCustomLink`)
// scrubs the legacy `custom_values` entry on the next commit, so
// the migration completes naturally as users touch each row.
const EMPTY_LINKED_IDS: readonly string[] = Object.freeze([]);

export function getCustomLink(
  row: {
    custom_links?: Record<string, string[]> | null | undefined;
    custom_values?: Record<string, unknown> | null | undefined;
  },
  fieldDef: FieldKeyRef,
): readonly string[] {
  const fieldKey = fieldKeyOf(fieldDef);
  const links = row.custom_links?.[fieldKey];
  if (links !== undefined) return links;
  const legacy = row.custom_values?.[fieldKey];
  if (Array.isArray(legacy)) {
    return legacy.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  return EMPTY_LINKED_IDS;
}

// Mirror of `setCustomValue` for the `custom_links` bag (Phase 1
// record-linking). The value is normalized to `string[]` here so apply
// paths can hand off whatever the cell write produced (a fill copies
// the accessor output, which is already a string[]; commits go through
// `commitLinkedRecord` which also emits string[]). Anything else
// collapses to an empty list, matching the backend coercer's tolerance.
export function setCustomLink<
  TRow extends {
    custom_links?: Record<string, string[]> | null | undefined;
    custom_values?: Record<string, unknown> | null | undefined;
  },
>(row: TRow, fieldDef: FieldKeyRef, value: unknown): TRow {
  const fieldKey = fieldKeyOf(fieldDef);
  const ids = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  const next: Record<string, string[]> = { ...(row.custom_links ?? {}) };
  next[fieldKey] = ids;
  let nextRow: TRow = { ...row, custom_links: next };
  // §B3 — bag exclusivity (other direction): a write into `custom_links`
  // must scrub any stale `custom_values[fieldKey]` entry (e.g. a field
  // just retyped text → linked_record). The accessor enforces the
  // invariant; backend `_validate_rows_custom_links` rejects rows that
  // carry both.
  if (row.custom_values && fieldKey in row.custom_values) {
    const nextValues: Record<string, unknown> = { ...row.custom_values };
    delete nextValues[fieldKey];
    nextRow = { ...nextRow, custom_values: nextValues };
  }
  return nextRow;
}

function fieldKeyOf(fieldDef: FieldKeyRef): string {
  return typeof fieldDef === "string" ? fieldDef : fieldDef.field_key;
}
