import type { UnitSystem } from "../../../../../lib/units";
import type { DataTableColumnDef, FieldDef, ViewState } from "../../types";
import { formatAggregation, type AggregationKind } from "../../fields/aggregations";
import { groupPathKey, resolveGroupRules } from "./plan";

// Aggregates at a given depth cover all descendant data rows —
// including those under collapsed inner groups. Output keys cover
// every distinct group pathKey reachable from `rows`, which doubles
// as the "what to collapse" set for Collapse-all.
export function computeAggregatesByPath<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumnDef<TRow>[],
  fieldDefs: readonly FieldDef[],
  view: Pick<ViewState, "group" | "aggregations">,
  groupAccessors?: readonly ((row: TRow) => unknown)[],
  unitSystem: UnitSystem = "SI",
): Map<string, { count: number; values: Map<string, string> }> {
  if (view.group.length === 0) return new Map();
  const resolvedAccessors =
    groupAccessors ?? resolveGroupRules(view.group, columns, fieldDefs)?.groupAccessors;
  if (!resolvedAccessors) return new Map();
  const columnByKey = new Map(columns.map((c) => [c.fieldKey, c]));
  const fieldDefByKey = new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
  const aggregated: {
    fieldKey: string;
    kind: AggregationKind;
    accessor: (row: TRow) => unknown;
    fieldDef: FieldDef | undefined;
  }[] = [];
  for (const [fieldKey, kind] of Object.entries(view.aggregations)) {
    if (kind === "none" || kind == null) continue;
    const column = columnByKey.get(fieldKey);
    if (!column) continue;
    aggregated.push({
      fieldKey,
      kind,
      accessor: column.accessor,
      fieldDef: fieldDefByKey.get(fieldKey),
    });
  }

  type PathAcc = { count: number; valueLists: Map<string, unknown[]> };
  const acc = new Map<string, PathAcc>();
  const ensure = (pathKey: string): PathAcc => {
    let entry = acc.get(pathKey);
    if (!entry) {
      entry = { count: 0, valueLists: new Map() };
      acc.set(pathKey, entry);
    }
    return entry;
  };

  for (const row of rows) {
    const path = resolvedAccessors.map((accessor) => accessor(row));
    for (let depth = 0; depth < view.group.length; depth += 1) {
      const pathKey = groupPathKey(path.slice(0, depth + 1));
      const entry = ensure(pathKey);
      entry.count += 1;
      for (const { fieldKey, accessor } of aggregated) {
        let list = entry.valueLists.get(fieldKey);
        if (!list) {
          list = [];
          entry.valueLists.set(fieldKey, list);
        }
        list.push(accessor(row));
      }
    }
  }

  const result = new Map<string, { count: number; values: Map<string, string> }>();
  for (const [pathKey, entry] of acc) {
    const values = new Map<string, string>();
    for (const { fieldKey, kind, fieldDef } of aggregated) {
      const list = entry.valueLists.get(fieldKey) ?? [];
      values.set(fieldKey, formatAggregation(kind, list, fieldDef, unitSystem));
    }
    result.set(pathKey, { count: entry.count, values });
  }
  return result;
}
