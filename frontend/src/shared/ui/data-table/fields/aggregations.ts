import {
  convertNumberUnitsToDisplay,
  numberUnitPrecision,
  type UnitSystem,
} from "../../../../lib/units";
import { clampNumberPrecision } from "../lib/numberPrecision";
import type { FieldDef } from "../types";

// Per-field-type aggregation catalogue + pure formatter. Mirrors the
// `filterOperators.ts` shape: catalogue tables as const, single
// dispatcher (`getAggregationKinds`), single evaluator
// (`formatAggregation`). The registry is the only place the library
// branches on `field_type`.

export type AggregationKind = "none" | "count" | "count_unique" | "sum" | "mean" | "min" | "max";

export type AggregationDef = {
  kind: AggregationKind;
  label: string;
};

export const TEXT_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
  { kind: "count_unique", label: "Count unique" },
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
  { kind: "count_unique", label: "Count unique" },
] as const;

export const COLOR_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
  { kind: "count_unique", label: "Count unique" },
] as const;

const EMPTY_AGGREGATIONS: readonly AggregationDef[] = [];

// `attachment` returns [] — no menu item appears for binary/list
// payload columns.
export function getAggregationKinds(fieldDef: FieldDef | undefined): readonly AggregationDef[] {
  if (!fieldDef) return EMPTY_AGGREGATIONS;
  switch (fieldDef.field_type) {
    case "text":
      return TEXT_AGGREGATIONS;
    case "number":
      return NUMBER_AGGREGATIONS;
    case "single_select":
      return SINGLE_SELECT_AGGREGATIONS;
    case "color":
      return COLOR_AGGREGATIONS;
    case "computed":
      return fieldDef.computed_type === "number" ? NUMBER_AGGREGATIONS : TEXT_AGGREGATIONS;
    case "lookup":
      return TEXT_AGGREGATIONS;
    case "attachment":
      return EMPTY_AGGREGATIONS;
    case "linked_record":
      // Phase 3 ships `count` via the formula `linked(...)` primitive;
      // direct cell aggregation stays out of v1.
      return EMPTY_AGGREGATIONS;
  }
}

// Pure formatter. Empty / no-data results yield "" for `count` and
// "—" for stat kinds so an empty mean cell still reads as "we tried,
// nothing to summarize."
//
// For number+units fields, sum/mean/min/max aggregate canonical SI
// values, then the result is converted to the active display unit and
// rendered at the configured precision (matching the cell-render
// rule). Plain Number falls back to the existing two-decimal format.
export function formatAggregation(
  kind: AggregationKind,
  values: readonly unknown[],
  fieldDef?: FieldDef,
  unitSystem: UnitSystem = "SI",
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
  if (kind === "count_unique") {
    const unique = new Set<string>();
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      unique.add(String(value));
    }
    return `${unique.size}`;
  }
  const nums = collectFiniteNumbers(values);
  if (nums.length === 0) return "—";
  const reduce = (): number => {
    switch (kind) {
      case "sum":
        return nums.reduce((a, b) => a + b, 0);
      case "mean":
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      case "min":
        return Math.min(...nums);
      case "max":
        return Math.max(...nums);
    }
  };
  const result = reduce();
  if (fieldDef?.field_type === "number" && fieldDef.numberUnits) {
    const display =
      unitSystem === "IP" ? convertNumberUnitsToDisplay(result, fieldDef.numberUnits) : result;
    return display.toFixed(numberUnitPrecision(fieldDef.numberUnits, unitSystem));
  }
  if (fieldDef?.field_type === "number" && fieldDef.numberPrecision !== undefined) {
    return result.toFixed(clampNumberPrecision(fieldDef.numberPrecision));
  }
  return formatNumber(result);
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
