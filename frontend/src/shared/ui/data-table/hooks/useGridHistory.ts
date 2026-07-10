import { useCallback, useMemo, useRef, useState } from "react";
import type { WriteOp } from "../types";

// Each entry pairs the forward op (already applied) with the inverse op
// that reverts it. Semantic, not per-cell — one Tab-commit, one paste,
// one row-insert is one entry (PoC L6.2).
export type HistoryEntry = {
  op: WriteOp;
  inverse: WriteOp;
};

export type GridHistory = {
  push: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const DEFAULT_CAPACITY = 50;

export function useGridHistory(opts?: { capacity?: number }): GridHistory {
  const capacity = opts?.capacity ?? DEFAULT_CAPACITY;
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Bump only exists so React re-renders when the stacks mutate; the
  // stacks live in refs so push/undo/redo are stable identities.
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const push = useCallback(
    (entry: HistoryEntry) => {
      undoStack.current.push(entry);
      if (undoStack.current.length > capacity) {
        undoStack.current.splice(0, undoStack.current.length - capacity);
      }
      redoStack.current = [];
      bump();
    },
    [capacity, bump],
  );

  const undo = useCallback((): HistoryEntry | null => {
    const entry = undoStack.current.pop();
    if (!entry) return null;
    redoStack.current.push(entry);
    bump();
    return entry;
  }, [bump]);

  const redo = useCallback((): HistoryEntry | null => {
    const entry = redoStack.current.pop();
    if (!entry) return null;
    undoStack.current.push(entry);
    bump();
    return entry;
  }, [bump]);

  const clear = useCallback(() => {
    if (undoStack.current.length === 0 && redoStack.current.length === 0) return;
    undoStack.current = [];
    redoStack.current = [];
    bump();
  }, [bump]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;
  return useMemo(
    () => ({ push, undo, redo, clear, canUndo, canRedo }),
    [canRedo, canUndo, clear, push, redo, undo],
  );
}
