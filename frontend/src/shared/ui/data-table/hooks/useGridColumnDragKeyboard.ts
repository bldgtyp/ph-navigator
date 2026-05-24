import { useCallback, useState } from "react";
import { reorderColumnIds } from "./useGridColumns";
import type { DataTableColumnDef } from "../types";

// Plan 08 §4.3 — accessible keyboard reorder for column headers.
// Tab moves focus to a header `<th>` (dnd-kit's sortable `attributes`
// already include `tabIndex: 0`); Space picks the column up; ←/→ shift
// the pickup target; Space commits; Esc cancels.
//
// The pickup state lives in this hook rather than in dnd-kit's
// KeyboardSensor so the announce text matches AirTable's pattern
// ("Picked up X", "Moved to position N", "Canceled.") and so the
// ←/→ step is column-major rather than dnd-kit's geometric "next
// droppable" navigation. While picked up, the keystroke handler at
// `SortableHeaderCell` (wired via `GridHeader`) routes ←/→/Space/Esc
// here and short-circuits other keyboard paths (Phase 3 cell-grid
// arrow nav, type-to-edit) with `preventDefault` so they don't fire
// on the focused header.

type PickupState = {
  // Current target position (changes as user presses ←/→).
  columnIndex: number;
  // Index where the column started (used to detect a no-op commit
  // and to resolve the moving column at drop time).
  originalIndex: number;
};

export type GridColumnDragKeyboardArgs<TRow> = {
  // The visible columns in display order. Index 0 is the primary /
  // frozen column (constraint 3) and is not pickable.
  visibleColumns: DataTableColumnDef<TRow>[];
  // Full id list (visible + hidden, in display order) — splice target
  // so hidden columns keep their relative positions even when the
  // reorder originates from a visible-only header pickup.
  fullOrderedColumnIds: string[];
  onColumnOrderChange: (next: string[]) => void;
  onAnnounce: (message: string) => void;
};

export type GridColumnDragKeyboard = {
  pickedUpColumnIndex: number | null;
  onPickup: (columnIndex: number) => void;
  onMove: (dx: -1 | 1) => void;
  onCommit: () => void;
  onCancel: () => void;
};

export function useGridColumnDragKeyboard<TRow>(
  args: GridColumnDragKeyboardArgs<TRow>,
): GridColumnDragKeyboard {
  const { visibleColumns, fullOrderedColumnIds, onColumnOrderChange, onAnnounce } = args;
  const [pickedUp, setPickedUp] = useState<PickupState | null>(null);

  const onPickup = useCallback(
    (columnIndex: number) => {
      // Index 0 is the primary / frozen column — never pickable.
      if (columnIndex <= 0) return;
      const column = visibleColumns[columnIndex];
      if (!column) return;
      setPickedUp({ columnIndex, originalIndex: columnIndex });
      onAnnounce(`Picked up ${column.header}. Use arrow keys to move, Space to drop, Escape to cancel.`);
    },
    [onAnnounce, visibleColumns],
  );

  const onMove = useCallback(
    (dx: -1 | 1) => {
      setPickedUp((current) => {
        if (!current) return current;
        // Clamp to [1, visibleColumns.length - 1] — never slot before
        // the primary column (constraint 3).
        const max = visibleColumns.length - 1;
        const next = Math.max(1, Math.min(max, current.columnIndex + dx));
        if (next === current.columnIndex) return current;
        return { ...current, columnIndex: next };
      });
    },
    [visibleColumns.length],
  );

  const onCommit = useCallback(() => {
    if (!pickedUp) return;
    if (pickedUp.columnIndex === pickedUp.originalIndex) {
      onAnnounce("Canceled.");
      setPickedUp(null);
      return;
    }
    const fromColumn = visibleColumns[pickedUp.originalIndex];
    const toColumn = visibleColumns[pickedUp.columnIndex];
    if (!fromColumn || !toColumn) {
      setPickedUp(null);
      return;
    }
    const nextOrder = reorderColumnIds(fullOrderedColumnIds, fromColumn.id, toColumn.id);
    if (nextOrder !== fullOrderedColumnIds) {
      onColumnOrderChange(nextOrder);
    }
    onAnnounce(`${fromColumn.header} moved to position ${pickedUp.columnIndex + 1}.`);
    setPickedUp(null);
  }, [fullOrderedColumnIds, onAnnounce, onColumnOrderChange, pickedUp, visibleColumns]);

  const onCancel = useCallback(() => {
    if (!pickedUp) return;
    onAnnounce("Canceled.");
    setPickedUp(null);
  }, [onAnnounce, pickedUp]);

  return {
    pickedUpColumnIndex: pickedUp?.columnIndex ?? null,
    onPickup,
    onMove,
    onCommit,
    onCancel,
  };
}
