import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Multi-row selection set driven by the gutter checkbox column (Phase 2
// §4.3). Lives outside the TanStack column model (PoC L2.2) and is
// independent of the cell range — clicking a body cell does not clear
// the row-selection set; checking a row does not collapse the cell
// range. The set drives only the toolbar Delete action in Phase 2.
//
// Click modes mirror AirTable / Finder / Excel: plain click replaces the
// set, Shift+Click extends a contiguous block from the anchor, and
// ⌘/Ctrl-Click toggles a single row.
export type RowSelectionMode = "single" | "shift" | "cmd";

export type GridRowSelection = {
  selectedRowIds: ReadonlySet<string>;
  count: number;
  anchorRowId: string | null;
  toggle: (rowId: string, mode: RowSelectionMode) => void;
  clear: () => void;
  isSelected: (rowId: string) => boolean;
};

export function useGridRowSelection(args: { rowIds: string[] }): GridRowSelection {
  const { rowIds } = args;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  // Track the rowIds array identity so we can clear the set when the
  // table swaps to a different rowset (refetch / project switch /
  // sub-tab change). Identity comparison matches the parallel rule in
  // useGridHistory.clear-on-rows-change (PoC L6.3).
  const previousRowIdsRef = useRef(rowIds);
  useEffect(() => {
    if (previousRowIdsRef.current === rowIds) return;
    previousRowIdsRef.current = rowIds;
    setSelected((current) => (current.size === 0 ? current : new Set()));
    setAnchor(null);
  }, [rowIds]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rowIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [rowIds]);

  const toggle = useCallback(
    (rowId: string, mode: RowSelectionMode) => {
      if (!rowIndexById.has(rowId)) return;
      if (mode === "single") {
        // Phase 3 R2: clicking the checkbox of the only selected row
        // unselects it — checkbox semantics. Clicking a different row
        // replaces the set (set's only entry becomes that row), so
        // multi-row state coming from Shift/Cmd is correctly cleared
        // by a subsequent plain click on any single checkbox.
        setSelected((current) => {
          if (current.size === 1 && current.has(rowId)) return new Set();
          return new Set([rowId]);
        });
        setAnchor((current) => (current === rowId ? null : rowId));
        return;
      }
      if (mode === "cmd") {
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(rowId)) next.delete(rowId);
          else next.add(rowId);
          return next;
        });
        setAnchor((current) => {
          // If the cmd-click left the set empty, drop the anchor.
          // Otherwise leave the anchor unchanged — anchors only move on
          // a plain (single-mode) click.
          return current;
        });
        return;
      }
      // shift
      if (anchor === null || !rowIndexById.has(anchor)) {
        setSelected(new Set([rowId]));
        setAnchor(rowId);
        return;
      }
      const anchorIndex = rowIndexById.get(anchor) ?? 0;
      const targetIndex = rowIndexById.get(rowId) ?? 0;
      const [start, end] =
        anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      setSelected((current) => {
        const next = new Set(current);
        for (let i = start; i <= end; i += 1) {
          const id = rowIds[i];
          if (id !== undefined) next.add(id);
        }
        return next;
      });
      // Anchor stays put on shift-extend.
    },
    [anchor, rowIds, rowIndexById],
  );

  const clear = useCallback(() => {
    setSelected((current) => (current.size === 0 ? current : new Set()));
    setAnchor(null);
  }, []);

  const isSelected = useCallback((rowId: string) => selected.has(rowId), [selected]);

  // Anchor cleanup: if a cmd-click emptied the set, drop the anchor.
  useEffect(() => {
    if (selected.size === 0 && anchor !== null) setAnchor(null);
  }, [selected, anchor]);

  return {
    selectedRowIds: selected,
    count: selected.size,
    anchorRowId: anchor,
    toggle,
    clear,
    isSelected,
  };
}
