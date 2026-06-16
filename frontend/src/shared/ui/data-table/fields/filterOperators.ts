import { parseNumberUnitsInput, type UnitSystem } from "../../../../lib/units";
import type { FieldDef, FilterCondition, FilterOperator } from "../types";
import { formatClipboardCellValue } from "../lib/paste/tsv";

// Phase 4 §4.2: per-field-type operator catalogue. Each entry declares
// its display label (verbatim AirTable phrasing per §12 Q8) and the
// shape of its value slot. The catalogue is the single source of
// operator semantics — `evaluateFilter` switches on `operator` to read
// the right slot, and `getFilterOperators(fieldDef)` returns the
// catalogue the popover dropdown should expose for that field.

export type FilterValueShape =
  | { kind: "none" } // is_empty / is_not_empty
  | { kind: "string" } // text contains / is / etc.
  | { kind: "number" } // = / != / > / <
  | { kind: "numberPair" } // between
  | { kind: "optionIdList" }; // single_select is_any_of

export type FilterOperatorDef = {
  operator: FilterOperator;
  label: string;
  shape: FilterValueShape;
};

export const TEXT_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "contains", label: "contains…", shape: { kind: "string" } },
  { operator: "does_not_contain", label: "does not contain…", shape: { kind: "string" } },
  { operator: "is", label: "is…", shape: { kind: "string" } },
  { operator: "is_not", label: "is not…", shape: { kind: "string" } },
  { operator: "is_empty", label: "is empty", shape: { kind: "none" } },
  { operator: "is_not_empty", label: "is not empty", shape: { kind: "none" } },
] as const;

export const NUMBER_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "eq", label: "=", shape: { kind: "number" } },
  { operator: "neq", label: "≠", shape: { kind: "number" } },
  { operator: "gt", label: ">", shape: { kind: "number" } },
  { operator: "lt", label: "<", shape: { kind: "number" } },
  { operator: "between", label: "between", shape: { kind: "numberPair" } },
  { operator: "is_empty", label: "is empty", shape: { kind: "none" } },
  { operator: "is_not_empty", label: "is not empty", shape: { kind: "none" } },
] as const;

export const SINGLE_SELECT_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "is_any_of", label: "is any of", shape: { kind: "optionIdList" } },
  { operator: "is_none_of", label: "is none of", shape: { kind: "optionIdList" } },
  { operator: "is_empty", label: "is empty", shape: { kind: "none" } },
  { operator: "is_not_empty", label: "is not empty", shape: { kind: "none" } },
] as const;

export const COLOR_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "is", label: "is…", shape: { kind: "string" } },
  { operator: "is_not", label: "is not…", shape: { kind: "string" } },
  { operator: "is_empty", label: "is empty", shape: { kind: "none" } },
  { operator: "is_not_empty", label: "is not empty", shape: { kind: "none" } },
] as const;

const EMPTY_OPERATORS: readonly FilterOperatorDef[] = [];

// `computed` defaults to text operators when `computed_type` is absent
// (preserves Phase 0–3 behaviour for existing computed columns).
// `attachment` returns [] because binary/list payloads do not filter
// through the toolbar.
export function getFilterOperators(fieldDef: FieldDef | undefined): readonly FilterOperatorDef[] {
  if (!fieldDef) return EMPTY_OPERATORS;
  switch (fieldDef.field_type) {
    case "text":
      return TEXT_OPERATORS;
    case "number":
      return NUMBER_OPERATORS;
    case "single_select":
      return SINGLE_SELECT_OPERATORS;
    case "color":
      return COLOR_OPERATORS;
    case "computed":
      return fieldDef.computed_type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS;
    case "lookup":
      return TEXT_OPERATORS;
    case "attachment":
      return EMPTY_OPERATORS;
    case "linked_record":
      // Phase 1: no filter operators surfaced for linked_record cells.
      return EMPTY_OPERATORS;
  }
}

// Reverse lookup: operator → def. Built once at module load so the
// popover row's per-render `getOperatorDef(rule.operator)` is O(1).
const OPERATOR_DEF_BY_NAME = new Map<FilterOperator, FilterOperatorDef>(
  [...TEXT_OPERATORS, ...NUMBER_OPERATORS, ...SINGLE_SELECT_OPERATORS, ...COLOR_OPERATORS].map(
    (def) => [def.operator, def],
  ),
);

export function getOperatorDef(operator: FilterOperator): FilterOperatorDef | undefined {
  return OPERATOR_DEF_BY_NAME.get(operator);
}

// Phase 4 §4.10: a contributing rule is one whose value slot is
// populated for its operator's shape. Dormant rules pass everything
// (§4.4) and DO NOT tint their column (matches AirTable's chip-color
// behaviour). The toolbar Filter button tints as soon as any rule
// exists, contributing or not — that decision lives in DataTable.tsx.
export function isFilterContributing(condition: FilterCondition): boolean {
  const def = getOperatorDef(condition.operator);
  if (!def) return false;
  switch (def.shape.kind) {
    case "none":
      return true;
    case "string":
    case "number":
      return Boolean(condition.value && condition.value.trim().length > 0);
    case "numberPair": {
      const [lo, hi] = condition.valuePair ?? ["", ""];
      return (
        Boolean(lo && lo.trim().length > 0) &&
        Boolean(hi && hi.trim().length > 0) &&
        parseNumberOrNull(lo) !== null &&
        parseNumberOrNull(hi) !== null
      );
    }
    case "optionIdList":
      return Boolean(condition.valueList && condition.valueList.length > 0);
  }
}

export function evaluateFilter(
  condition: FilterCondition,
  cellValue: unknown,
  fieldDef: FieldDef,
  unitSystem: UnitSystem = "SI",
): boolean {
  // Number+units fields parse user input in the active display system
  // and convert to SI; cell values are already SI, so comparison is a
  // single SI-vs-SI float compare. Plain numbers preserve raw Number()
  // parsing.
  const parseUserNumber = (raw: string | undefined): number | null =>
    fieldDef.field_type === "number" && fieldDef.numberUnits
      ? parseNumberUnitsInputOrNull(raw, fieldDef.numberUnits, unitSystem)
      : parseNumberOrNull(raw);
  switch (condition.operator) {
    case "is_empty":
      return isCellEmpty(cellValue);
    case "is_not_empty":
      return !isCellEmpty(cellValue);

    case "contains": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return formatClipboardCellValue(cellValue, fieldDef, unitSystem)
        .toLowerCase()
        .includes(expected);
    }
    case "does_not_contain": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return !formatClipboardCellValue(cellValue, fieldDef, unitSystem)
        .toLowerCase()
        .includes(expected);
    }
    case "is": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return (
        formatClipboardCellValue(cellValue, fieldDef, unitSystem).trim().toLowerCase() === expected
      );
    }
    case "is_not": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return (
        formatClipboardCellValue(cellValue, fieldDef, unitSystem).trim().toLowerCase() !== expected
      );
    }

    case "eq":
      return numCompare(cellValue, parseUserNumber(condition.value), (a, b) => a === b);
    case "neq":
      return numCompare(cellValue, parseUserNumber(condition.value), (a, b) => a !== b);
    case "gt":
      return numCompare(cellValue, parseUserNumber(condition.value), (a, b) => a > b);
    case "lt":
      return numCompare(cellValue, parseUserNumber(condition.value), (a, b) => a < b);
    case "between": {
      const lo = parseUserNumber(condition.valuePair?.[0]);
      const hi = parseUserNumber(condition.valuePair?.[1]);
      if (lo === null || hi === null) return true;
      const cell = parseNumberOrNull(cellValue);
      if (cell === null) return false;
      const [low, high] = lo <= hi ? [lo, hi] : [hi, lo];
      return cell >= low && cell <= high;
    }

    case "is_any_of": {
      const list = condition.valueList ?? [];
      if (list.length === 0) return true;
      return typeof cellValue === "string" && list.includes(cellValue);
    }
    case "is_none_of": {
      const list = condition.valueList ?? [];
      if (list.length === 0) return true;
      return !(typeof cellValue === "string" && list.includes(cellValue));
    }
  }
}

// Number 0 is NOT empty (matches AirTable). Strings are empty when
// trimmed to "". Anything else non-null/undefined is non-empty.
function isCellEmpty(cellValue: unknown): boolean {
  if (cellValue === null || cellValue === undefined) return true;
  if (typeof cellValue === "string") return cellValue.trim() === "";
  return false;
}

function numCompare(
  cellValue: unknown,
  expected: number | null,
  predicate: (cell: number, expected: number) => boolean,
): boolean {
  if (expected === null) return true; // dormant
  const cell = parseNumberOrNull(cellValue);
  if (cell === null) return false; // cell cannot satisfy a numeric comparison
  return predicate(cell, expected);
}

function parseNumberUnitsInputOrNull(
  raw: string | undefined,
  config: NonNullable<FieldDef["numberUnits"]>,
  unitSystem: UnitSystem,
): number | null {
  if (typeof raw !== "string") return null;
  const parsed = parseNumberUnitsInput(raw, config, unitSystem);
  return parsed === undefined ? null : parsed;
}

function parseNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
