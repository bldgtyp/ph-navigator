import type { UnitSystem } from "../../../../lib/units";
import { formatAggregation, type AggregationKind } from "../fields/aggregations";
import type { FieldDef } from "../types";

// Plan 06 §4.1: pure helper used by `<SummaryBar>` to render a single
// aggregate cell. Walks `rows` through the column accessor, then
// dispatches to the existing `formatAggregation` registry — same
// formatter the per-group header rows use, so summary-bar and group-
// header cells render identically for matching row sets.
//
// `kind` of "none" short-circuits to "" so callers can pass through
// every column without pre-checking the picked aggregation.
export function computeAggregate<TRow>(
  kind: AggregationKind,
  rows: readonly TRow[],
  accessor: (row: TRow) => unknown,
  fieldDef?: FieldDef,
  unitSystem: UnitSystem = "SI",
): string {
  if (kind === "none") return "";
  const values: unknown[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i += 1) values[i] = accessor(rows[i] as TRow);
  return formatAggregation(kind, values, fieldDef, unitSystem);
}
