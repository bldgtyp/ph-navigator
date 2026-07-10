import { formatNumberUnitsDisplay, type UnitSystem } from "../../../../../lib/units";
import type { FieldDef, FieldOption } from "../../types";
import { displayUnitsFor } from "../fieldUnits";
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
  // A unit-bearing field (number, or a numeric formula) formats its SI value
  // through the unit path so display / clipboard / CSV all agree. A formula
  // error overlay is an object, not a number, so it's excluded and falls
  // through to the raw path — never unit-formatted.
  const displayUnits = displayUnitsFor(fieldDef);
  if (displayUnits && (fieldDef?.field_type === "number" || typeof value === "number")) {
    return formatNumberUnitsDisplay(value, displayUnits, unitSystem);
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
