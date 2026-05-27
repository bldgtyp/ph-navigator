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
// Plan 08 — splice helper used by both the header drag (`DataTable`)
// and the Hide-fields panel drag (`HideFieldsPanel`). Operates on the
// full ordered id list so hidden columns keep their relative positions
// even when the visible reorder originates from the header. Returns
// the input array unchanged when from/to are equal or either id is
// missing — callers can pass the result straight to `onViewChange`.
export function reorderColumnIds(
  fullOrder: string[],
  fromColumnId: string,
  toColumnId: string,
): string[] {
  if (fromColumnId === toColumnId) return fullOrder;
  const fromIndex = fullOrder.indexOf(fromColumnId);
  const toIndex = fullOrder.indexOf(toColumnId);
  if (fromIndex < 0 || toIndex < 0) return fullOrder;
  const next = [...fullOrder];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return fullOrder;
  next.splice(toIndex, 0, moved);
  return next;
}

// When a `pinnedColumnId` is provided, that column is forced to slot 0
// of the ordered/visible list regardless of `columnOrder` and is never
// hidden. DataTable uses this for the real `record_id` column.
export function useGridColumns<TRow>(
  columnDefs: DataTableColumnDef<TRow>[],
  columnOrder: string[],
  hiddenColumns: string[],
  pinnedColumnId?: string | null,
): DataTableColumnDef<TRow>[] {
  return useMemo(() => {
    const byId = new Map(columnDefs.map((column) => [column.id, column]));
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    if (pinnedColumnId && byId.has(pinnedColumnId)) {
      orderedIds.push(pinnedColumnId);
      seen.add(pinnedColumnId);
    }
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
  }, [columnDefs, columnOrder, hiddenColumns, pinnedColumnId]);
}
