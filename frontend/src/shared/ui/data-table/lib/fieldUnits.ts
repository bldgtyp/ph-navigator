import type { NumberUnitsConfig } from "../../../../lib/units";
import type { FieldDef } from "../types";

/**
 * The display units a field formats through, or `undefined` when it has none.
 *
 * `numberUnits` is populated by the single mapping seam in `useTableSchema`
 * only for number fields and numeric formulas (`field_type === "computed"`
 * with `result_type === "number"`). So a field is unit-bearing exactly when it
 * carries `numberUnits` — no `field_type` check is needed. Routing every
 * display site (grid cell, column header, clipboard, CSV) through this one
 * accessor keeps them from re-enumerating which field types show a unit, so a
 * future unit-bearing type is a one-line change here, not a scatter of edits.
 */
export function displayUnitsFor(fieldDef: FieldDef | undefined): NumberUnitsConfig | undefined {
  return fieldDef?.numberUnits;
}
