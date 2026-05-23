import { useCallback } from "react";
import type { WriteOp } from "../types";
import type { GridHistory, HistoryEntry } from "./useGridHistory";

// Every gesture (inline edit, paste, future row-insert, fill, etc.)
// routes through this chokepoint — the single write primitive (PoC L6.1).
// Callers provide the forward op and its inverse; we push the history
// entry and forward the op to the consumer's onWrite.

export type DispatchOptions = {
  // True when the dispatch comes from an undo/redo step. The op is still
  // forwarded to onWrite so the consumer materializes the change, but we
  // do NOT push a new history entry — the caller is responsible for
  // moving the entry between the undo and redo stacks.
  skipHistory?: boolean;
};

export type DispatchWrite = (
  op: WriteOp,
  inverse: WriteOp,
  options?: DispatchOptions,
) => Promise<void>;

export type GridWriteReducer = {
  dispatchWrite: DispatchWrite;
  undoOnce: () => Promise<HistoryEntry | null>;
  redoOnce: () => Promise<HistoryEntry | null>;
};

export function useGridWriteReducer(args: {
  history: GridHistory;
  onWrite?: (op: WriteOp) => void | Promise<void>;
}): GridWriteReducer {
  const { history, onWrite } = args;

  const dispatchWrite = useCallback<DispatchWrite>(
    async (op, inverse, options) => {
      if (!onWrite) return;
      await onWrite(op);
      // History is only touched after onWrite resolves, so a rejected
      // write leaves both stacks unchanged.
      if (!options?.skipHistory) {
        history.push({ op, inverse });
      }
    },
    [history, onWrite],
  );

  const undoOnce = useCallback(async () => {
    const entry = history.undo();
    if (!entry || !onWrite) return entry;
    await onWrite(entry.inverse);
    return entry;
  }, [history, onWrite]);

  const redoOnce = useCallback(async () => {
    const entry = history.redo();
    if (!entry || !onWrite) return entry;
    await onWrite(entry.op);
    return entry;
  }, [history, onWrite]);

  return { dispatchWrite, undoOnce, redoOnce };
}
