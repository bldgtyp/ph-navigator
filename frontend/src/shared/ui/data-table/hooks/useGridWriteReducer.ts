import { useCallback } from "react";
import type { WriteOp, WriteResult } from "../types";
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
) => Promise<WriteResult>;

export type GridWriteReducer = {
  dispatchWrite: DispatchWrite;
  undoOnce: () => Promise<HistoryEntry | null>;
  redoOnce: () => Promise<HistoryEntry | null>;
};

export function useGridWriteReducer(args: {
  history: GridHistory;
  onWrite?: (op: WriteOp) => WriteResult | Promise<WriteResult>;
  onAnnounce?: (message: string) => void;
}): GridWriteReducer {
  const { history, onWrite, onAnnounce } = args;

  const dispatchWrite = useCallback<DispatchWrite>(
    async (op, inverse, options) => {
      if (!onWrite) return;
      const result = await onWrite(op);
      // History is only touched after onWrite resolves, so a rejected
      // write leaves both stacks unchanged. When the consumer's backend
      // assigned server ids to inserted rows, retarget the inverse
      // (rowDelete) onto them — undoing a catalog insert must delete
      // the persisted row, not the defunct tmp id.
      if (!options?.skipHistory) {
        const mapping = result?.insertedRowIds;
        history.push({ op, inverse: mapping ? remapDeleteRowIds(inverse, mapping) : inverse });
      }
      return result;
    },
    [history, onWrite],
  );

  const replayOnce = useCallback(
    async (direction: "undo" | "redo") => {
      const entry = direction === "undo" ? history.undo() : history.redo();
      if (!entry || !onWrite) return entry;
      const op = direction === "undo" ? entry.inverse : entry.op;
      try {
        await onWrite(op);
        onAnnounce?.(`${direction === "undo" ? "Undid" : "Redid"} ${writeOpLabel(entry.op)}.`);
        return entry;
      } catch (error) {
        history.clear();
        throw error;
      }
    },
    [history, onAnnounce, onWrite],
  );

  const undoOnce = useCallback(async () => {
    return replayOnce("undo");
  }, [replayOnce]);

  const redoOnce = useCallback(async () => {
    return replayOnce("redo");
  }, [replayOnce]);

  return { dispatchWrite, undoOnce, redoOnce };
}

function remapDeleteRowIds(inverse: WriteOp, mapping: Record<string, string>): WriteOp {
  if (inverse.kind !== "rowDelete") return inverse;
  return {
    ...inverse,
    rows: inverse.rows.map((row) => ({
      ...row,
      rowId: mapping[row.rowId] ?? row.rowId,
    })),
  };
}

function writeOpLabel(op: WriteOp): string {
  switch (op.kind) {
    case "cell":
      return "cell edit";
    case "rowInsert":
      return "row insert";
    case "rowDelete":
      return "row delete";
    case "rowDuplicate":
      return "row duplicate";
    case "schemaMutation":
      return "schema change";
    default:
      return op.kind;
  }
}
