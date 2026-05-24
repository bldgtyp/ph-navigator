import type { FieldDef } from "../types";

// Per-field-type aggregation catalogue + pure formatter. Mirrors the
// `filterOperators.ts` shape: catalogue tables as const, single
// dispatcher (`getAggregationKinds`), single evaluator
// (`formatAggregation`). The registry is the only place the library
// branches on `field_type`.

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

// `attachment` / `argb_color` return [] — no menu item appears for
// those columns.
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

// Pure formatter. Empty / no-data results yield "" for `count` and
// "—" for stat kinds so an empty mean cell still reads as "we tried,
// nothing to summarize."
export function formatAggregation(kind: AggregationKind, values: readonly unknown[]): string {
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
      return formatNumber(nums.reduce((a, b) => a + b, 0));
    case "mean":
      return formatNumber(nums.reduce((a, b) => a + b, 0) / nums.length);
    case "min":
      return formatNumber(Math.min(...nums));
    case "max":
      return formatNumber(Math.max(...nums));
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

// Two decimals matches Rooms' existing `icfa_factor.toFixed(2)` cell
// display. A future phase can extend FieldDef with a richer
// `numberFormat` slot.
function formatNumber(n: number): string {
  return n.toFixed(2);
}
