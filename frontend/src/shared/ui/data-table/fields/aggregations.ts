import type { FieldDef } from "../types";

// Phase 6 §4.8: per-field-type aggregation catalogue + pure formatter.
// Matches the `filterOperators.ts` shape one-to-one: catalogue tables
// as const, single dispatcher (`getAggregationKinds`), single
// evaluator (`formatAggregation`). The registry is the single place
// the library branches on `field_type` (L2.3).

export type AggregationKind = "none" | "count" | "sum" | "mean" | "min" | "max";

export type AggregationDef = {
  kind: AggregationKind;
  label: string;
};

export const TEXT_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
] as const;

export const NUMBER_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
  { kind: "sum", label: "Sum" },
  { kind: "mean", label: "Mean" },
  { kind: "min", label: "Min" },
  { kind: "max", label: "Max" },
] as const;

export const SINGLE_SELECT_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
] as const;

const EMPTY_AGGREGATIONS: readonly AggregationDef[] = [];

// `computed` with computed_type === "number" reuses NUMBER; otherwise
// reuses TEXT (matches the filter-operator pattern). `attachment` and
// `argb_color` return [] — no menu item appears for those columns.
export function getAggregationKinds(fieldDef: FieldDef | undefined): readonly AggregationDef[] {
  if (!fieldDef) return EMPTY_AGGREGATIONS;
  switch (fieldDef.field_type) {
    case "text":
      return TEXT_AGGREGATIONS;
    case "number":
      return NUMBER_AGGREGATIONS;
    case "single_select":
      return SINGLE_SELECT_AGGREGATIONS;
    case "computed":
      return fieldDef.computed_type === "number" ? NUMBER_AGGREGATIONS : TEXT_AGGREGATIONS;
    case "attachment":
    case "argb_color":
      return EMPTY_AGGREGATIONS;
  }
}

// Pure formatter. Returns a display string for the group-header cell.
// Empty / no-data results yield "" for `count` (consistent with cell-
// empty display) and "—" for stat kinds (so an empty mean cell still
// reads as "we tried, nothing to summarize"). `none` always renders
// as "" — the absence of an entry in `view.aggregations` IS `none`.
export function formatAggregation(
  kind: AggregationKind,
  values: readonly unknown[],
  fieldDef: FieldDef | undefined,
): string {
  if (kind === "none") return "";
  if (kind === "count") {
    let n = 0;
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      n += 1;
    }
    return `${n}`;
  }
  const nums = collectFiniteNumbers(values);
  if (nums.length === 0) return "—";
  switch (kind) {
    case "sum":
      return formatNumber(nums.reduce((a, b) => a + b, 0), fieldDef);
    case "mean":
      return formatNumber(nums.reduce((a, b) => a + b, 0) / nums.length, fieldDef);
    case "min":
      return formatNumber(Math.min(...nums), fieldDef);
    case "max":
      return formatNumber(Math.max(...nums), fieldDef);
  }
}

function collectFiniteNumbers(values: readonly unknown[]): number[] {
  const nums: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      nums.push(value);
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) nums.push(parsed);
    }
  }
  return nums;
}

// Two-decimal formatting matches Rooms' existing `icfa_factor.toFixed(2)`
// display (§12 Q12). A future phase can extend FieldDef with a
// `numberFormat` slot; Phase 6 keeps the dependency on fieldDef so the
// signature is stable when that lands.
function formatNumber(n: number, _fieldDef: FieldDef | undefined): string {
  return n.toFixed(2);
}
