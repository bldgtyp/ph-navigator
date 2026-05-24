import { useMemo } from "react";
import type { DataTableColumnDef } from "../types";

// Plan 07 §4.2: derive the ordered, visible columns list from the raw
// `columnDefs` plus the user's `columnOrder` + `hiddenColumns`. One
// surface — header, body, summary bar, plan 06/08 — all consult this
// helper so the visible-columns rule lives in one place.
//
// Two invariants this enforces (constraint 3 in the plan):
// 1. `columnOrder` lists column ids in display order; ids missing
//    from the order list append in declaration order (so a newly
//    added column shows up without the user having to re-order).
// 2. The first column in the ordered list is the primary/frozen
//    column and is NEVER hidden, even if its id appears in
//    `hiddenColumns`. The toolbar UI prevents the user from toggling
//    it, but this guard is the source of truth.
export function useGridColumns<TRow>(
  columnDefs: DataTableColumnDef<TRow>[],
  columnOrder: string[],
  hiddenColumns: string[],
): DataTableColumnDef<TRow>[] {
  return useMemo(() => {
    const byId = new Map(columnDefs.map((column) => [column.id, column]));
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const id of columnOrder) {
      if (byId.has(id) && !seen.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    }
    for (const column of columnDefs) {
      if (!seen.has(column.id)) {
        orderedIds.push(column.id);
        seen.add(column.id);
      }
    }
    const hidden = new Set(hiddenColumns);
    return orderedIds
      .map((id, index) => {
        const column = byId.get(id);
        if (!column) return null;
        // Primary column (index 0 after ordering) is never hidden.
        if (index === 0) return column;
        return hidden.has(id) ? null : column;
      })
      .filter((column): column is DataTableColumnDef<TRow> => column !== null);
  }, [columnDefs, columnOrder, hiddenColumns]);
}
