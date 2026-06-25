import { formatNumberUnitsDisplay, type UnitSystem } from "../../../../../lib/units";
import type { FieldDef, FieldOption } from "../../types";
import { formatPlainNumberDisplay } from "../numberDisplay";
import { formatClipboardValue } from "../paste/tsv";

// `unitSystem` is only consulted for number fields whose FieldDef carries
// `numberUnits`; defaults to "SI" so non-unit callsites are unchanged.
export function formatDisplayCellValue(
  value: unknown,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem = "SI",
): string {
  if (fieldDef?.field_type === "single_select") {
    if (value === null || value === undefined || value === "") return "";
    const option = singleSelectOption(value, fieldDef);
    return option?.label ?? "Missing option";
  }
  if (fieldDef?.field_type === "number" && fieldDef.numberUnits) {
    return formatNumberUnitsDisplay(value, fieldDef.numberUnits, unitSystem);
  }
  if (fieldDef?.field_type === "number") {
    return formatPlainNumberDisplay(value, fieldDef);
  }
  return formatClipboardValue(value);
}

export function singleSelectOption(
  value: unknown,
  fieldDef: FieldDef | undefined,
): FieldOption | undefined {
  if (fieldDef?.field_type !== "single_select" || typeof value !== "string") return undefined;
  return fieldDef.options?.find((candidate) => candidate.id === value);
}
