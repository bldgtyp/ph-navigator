import type { FieldDef, FieldLockKey } from "../types";

export const FIELD_LOCKED_TOOLTIP = "Field Locked";

// PRD §P5.0 — every built-in seed ships with at least these locks
// unless the field explicitly opts out. Tightening this default is one
// edit that ripples to every seed.
export const DEFAULT_BUILT_IN_LOCKS: readonly FieldLockKey[] = ["delete", "duplicate"];

// Complete lock set for renderer-only fields whose schema is visible
// but not user-authorable, such as attachment fields.
export const ALL_FIELD_LOCKS: readonly FieldLockKey[] = [
  "display_name",
  "field_type",
  "options",
  "default",
  "description",
  "formula",
  "delete",
  "duplicate",
];

export function isAttributeLocked(
  fieldDef: Pick<FieldDef, "locked"> | null | undefined,
  key: FieldLockKey,
): boolean {
  if (!fieldDef?.locked) return false;
  return fieldDef.locked.includes(key);
}

export function isBuiltInField(fieldDef: Pick<FieldDef, "built_in"> | null | undefined): boolean {
  return fieldDef?.built_in === true;
}

export function isFieldDeletable(fieldDef: FieldDef | null | undefined): boolean {
  if (!fieldDef) return false;
  return !isAttributeLocked(fieldDef, "delete");
}

export function isFieldDuplicable(fieldDef: FieldDef | null | undefined): boolean {
  if (!fieldDef) return false;
  return !isAttributeLocked(fieldDef, "duplicate");
}
