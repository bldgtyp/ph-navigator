import { useCallback, useMemo, useState } from "react";
import { moveActiveCell, normalizeRange, type NormalizedRange } from "../lib";
import type { CellCoord, CellRange } from "../types";

// A selection is anchored on stable identity (PoC L1.1). Visual indices
// are derived per render so a row reorder, filter, or refetch repaints
// the selection in the right place without losing track of which cells
// the user originally pointed at.
export type CellAddr = {
  rowId: string;
  fieldKey: string;
};

export type GridSelection = {
  anchor: CellAddr | null;
  focus: CellAddr | null;

  // Visual projections. Always in-range relative to rowIds/fieldKeys.
  activeCell: CellCoord;
  range: CellRange;
  normalizedRange: NormalizedRange;
  hasExplicitRange: boolean;

  setActive: (addr: CellAddr) => void;
  extendTo: (addr: CellAddr) => void;
  collapse: () => void;
  selectRow: (rowId: string) => void;
  selectColumn: (fieldKey: string) => void;
  extendToColumn: (fieldKey: string) => void;
  selectAll: () => void;
  moveBy: (key: string, extend: boolean) => void;
};

export function useGridSelection(args: { rowIds: string[]; fieldKeys: string[] }): GridSelection {
  const { rowIds, fieldKeys } = args;
  const [anchor, setAnchor] = useState<CellAddr | null>(null);
  const [focus, setFocus] = useState<CellAddr | null>(null);
  // Distinguishes "user dragged a real range" from "anchor === focus"
  // (single-cell focus). Used by the visual projection so the active
  // cell doesn't show a 1x1 selection outline.
  const [explicit, setExplicit] = useState(false);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rowIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [rowIds]);
  const columnIndexByFieldKey = useMemo(() => {
    const map = new Map<string, number>();
    fieldKeys.forEach((key, index) => map.set(key, index));
    return map;
  }, [fieldKeys]);

  const resolveCoord = useCallback(
    (addr: CellAddr | null, fallback: CellCoord): CellCoord => {
      if (!addr) return fallback;
      const rowIndex = rowIndexById.get(addr.rowId);
      const columnIndex = columnIndexByFieldKey.get(addr.fieldKey);
      if (rowIndex === undefined || columnIndex === undefined) return fallback;
      return { rowIndex, columnIndex };
    },
    [rowIndexById, columnIndexByFieldKey],
  );

  const origin: CellCoord = { rowIndex: 0, columnIndex: 0 };
  const focusCoord = resolveCoord(focus, origin);
  const anchorCoord = resolveCoord(anchor, focusCoord);
  const range: CellRange = { anchor: anchorCoord, focus: focusCoord };
  const normalizedRange = normalizeRange(range);

  const addrAt = useCallback(
    (coord: CellCoord): CellAddr | null => {
      const rowId = rowIds[coord.rowIndex];
      const fieldKey = fieldKeys[coord.columnIndex];
      if (rowId === undefined || fieldKey === undefined) return null;
      return { rowId, fieldKey };
    },
    [rowIds, fieldKeys],
  );

  const setActive = useCallback((addr: CellAddr) => {
    setAnchor(addr);
    setFocus(addr);
    setExplicit(false);
  }, []);

  const extendTo = useCallback((addr: CellAddr) => {
    setFocus(addr);
    setExplicit(true);
    // Anchor only seeds on first extension; preserve if already set.
    setAnchor((current) => current ?? addr);
  }, []);

  const collapse = useCallback(() => {
    setExplicit(false);
    setAnchor((current) => (current ? { ...current } : current));
  }, []);

  const selectRow = useCallback(
    (rowId: string) => {
      const firstKey = fieldKeys[0];
      const lastKey = fieldKeys[fieldKeys.length - 1];
      if (!firstKey || !lastKey) return;
      setAnchor({ rowId, fieldKey: firstKey });
      setFocus({ rowId, fieldKey: lastKey });
      setExplicit(true);
    },
    [fieldKeys],
  );

  const selectColumn = useCallback(
    (fieldKey: string) => {
      const firstRow = rowIds[0];
      const lastRow = rowIds[rowIds.length - 1];
      if (!firstRow || !lastRow) return;
      setAnchor({ rowId: firstRow, fieldKey });
      setFocus({ rowId: lastRow, fieldKey });
      setExplicit(true);
    },
    [rowIds],
  );

  // Phase 3 §4.4: extends the active range across to another column-
  // header. Preserves the existing anchor's rowId so a Shift+Click on
  // a column strip after a column-strip click extends to the full
  // contiguous column block. If there is no prior anchor, falls
  // through to `selectColumn`.
  const extendToColumn = useCallback(
    (fieldKey: string) => {
      const lastRow = rowIds[rowIds.length - 1];
      if (!lastRow) return;
      setAnchor((current) => {
        if (current) return current;
        const firstRow = rowIds[0];
        return firstRow ? { rowId: firstRow, fieldKey } : current;
      });
      setFocus({ rowId: lastRow, fieldKey });
      setExplicit(true);
    },
    [rowIds],
  );

  const selectAll = useCallback(() => {
    const firstRow = rowIds[0];
    const lastRow = rowIds[rowIds.length - 1];
    const firstKey = fieldKeys[0];
    const lastKey = fieldKeys[fieldKeys.length - 1];
    if (!firstRow || !lastRow || !firstKey || !lastKey) return;
    setAnchor({ rowId: firstRow, fieldKey: firstKey });
    setFocus({ rowId: lastRow, fieldKey: lastKey });
    setExplicit(true);
  }, [rowIds, fieldKeys]);

  const moveBy = useCallback(
    (key: string, extend: boolean) => {
      const next = moveActiveCell(focusCoord, key, rowIds.length, fieldKeys.length);
      if (next === focusCoord) return;
      const nextAddr = addrAt(next);
      if (!nextAddr) return;
      if (extend) {
        setFocus(nextAddr);
        setExplicit(true);
        setAnchor((current) => current ?? addrAt(focusCoord));
      } else {
        setAnchor(nextAddr);
        setFocus(nextAddr);
        setExplicit(false);
      }
    },
    [focusCoord, rowIds.length, fieldKeys.length, addrAt],
  );

  return {
    anchor,
    focus,
    activeCell: focusCoord,
    range,
    normalizedRange,
    hasExplicitRange: explicit,
    setActive,
    extendTo,
    collapse,
    selectRow,
    selectColumn,
    extendToColumn,
    selectAll,
    moveBy,
  };
}
