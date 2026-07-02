import type { FieldDef, OptionMutability } from "../../types";

export function optionMutabilityForField(
  fieldDef: Pick<FieldDef, "locked" | "optionMutability"> | null | undefined,
): OptionMutability {
  if (fieldDef?.optionMutability) return fieldDef.optionMutability;
  return fieldDef?.locked?.includes("options") ? "locked" : "editable";
}

export function canEditFieldOptions(
  fieldDef: Pick<FieldDef, "locked" | "optionMutability"> | null | undefined,
): boolean {
  return optionMutabilityForField(fieldDef) === "editable";
}
