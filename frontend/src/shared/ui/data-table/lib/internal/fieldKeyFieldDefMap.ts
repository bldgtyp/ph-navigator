import type { FieldDef } from "../../types";

export function fieldKeyFieldDefMap(fieldDefs: readonly FieldDef[]): Map<string, FieldDef> {
  return new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
}
