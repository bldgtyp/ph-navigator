import type { FieldDef } from "../types";
import type { FieldEditor } from "./types";

export { getFilterOperators, evaluateFilter, isFilterContributing } from "./filterOperators";
export type { FilterOperatorDef, FilterValueShape } from "./filterOperators";
export { getAggregationKinds, formatAggregation } from "./aggregations";
export type { AggregationDef, AggregationKind } from "./aggregations";

// Resolve the editor a field type uses for inline edit. The registry is
// the one place that maps `FieldType` → behavior; both the keyboard
// dispatch and the body cell renderer consult it so the
// type-to-edit / Enter-to-edit / popover selection paths stay in sync.
export function getFieldEditor(fieldDef: FieldDef | undefined): FieldEditor {
  if (!fieldDef || fieldDef.read_only) return { kind: "none" };
  switch (fieldDef.field_type) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "single_select":
      return { kind: "single_select" };
    case "color":
      return { kind: "color" };
    case "computed":
    case "attachment":
    case "lookup":
      return { kind: "none" };
    case "linked_record":
      return { kind: "linked_record" };
  }
}
