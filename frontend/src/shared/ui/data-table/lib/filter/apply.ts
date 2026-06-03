import type { UnitSystem } from "../../../../../lib/units";
import type { DataTableColumnDef, FieldDef, FilterCondition, FilterOperator } from "../../types";
import {
  evaluateFilter,
  getFilterOperators,
  isFilterContributing,
} from "../../fields/filterOperators";
import { fieldKeyColumnMap } from "../internal/fieldKeyColumnMap";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";

// Route every condition through the field-type registry's
// `evaluateFilter` — operator semantics live in
// `fields/filterOperators.ts`. Dormant rules (blank value / unparsable
// number / empty option list) pass everything per L8.4. Conditions
// whose field is unknown, whose field exposes no operators, or whose
// value slots aren't yet contributing are pre-filtered outside the row
// loop, so when no rule is actually narrowing we return `rows` by
// identity (preserves downstream memo identity on `filteredRows`).
export function applyFilters<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  filters: FilterCondition[],
  unitSystem: UnitSystem = "SI",
): TRow[] {
  if (filters.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const activeRules: {
    filter: FilterCondition;
    column: DataTableColumnDef<TRow>;
    fieldDef: FieldDef;
  }[] = [];
  for (const filter of filters) {
    if (!filter.fieldKey) continue;
    const column = columnsByFieldKey.get(filter.fieldKey);
    if (!column) continue;
    const fieldDef = fieldDefsByKey.get(filter.fieldKey);
    if (!fieldDef) continue;
    if (getFilterOperators(fieldDef).length === 0) continue;
    if (!isFilterContributing(filter)) continue;
    activeRules.push({ filter, column, fieldDef });
  }
  if (activeRules.length === 0) return rows;
  return rows.filter((row) =>
    activeRules.every(({ filter, column, fieldDef }) =>
      evaluateFilter(filter, column.accessor(row), fieldDef, unitSystem),
    ),
  );
}

// Phase 4 §4.4: pick the first operator the registry exposes for a
// field. Used by the FilterPopover when adding a new rule and when the
// user changes a rule's field to one that doesn't support the rule's
// current operator. Returns null when the field has no operators
// and the popover skips such fields.
export function defaultOperatorForField(fieldDef: FieldDef | undefined): FilterOperator | null {
  const operators = getFilterOperators(fieldDef);
  return operators[0]?.operator ?? null;
}
