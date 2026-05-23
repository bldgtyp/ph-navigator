import { useCallback, useState } from "react";
import { coerceFieldValue, formatClipboardValue } from "../lib";
import type { CellWrite, FieldDef, WriteOp } from "../types";
import type { DispatchWrite } from "./useGridWriteReducer";

// Inline edit lifecycle. Phase 0 keeps the existing behaviors —
// double-click starts, blur cancels, Enter commits, Tab commits-and-
// moves — but routes every commit through the shared write reducer so
// undo records each cell change as one semantic op.
export type EditingCell = {
  rowId: string;
  fieldKey: string;
  draftValue: string;
  originalValue: unknown;
};

export type StartArgs = {
  rowId: string;
  fieldKey: string;
  initialValue: unknown;
};

export type GridEdit = {
  editing: EditingCell | null;
  isEditingCell: (rowId: string, fieldKey: string) => boolean;
  start: (args: StartArgs) => void;
  draft: (value: string) => void;
  commit: () => Promise<boolean>;
  cancel: () => void;
};

export function useGridEdit(args: {
  fieldDefByKey: Map<string, FieldDef>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  hasWriteHandler: boolean;
}): GridEdit {
  const { fieldDefByKey, dispatchWrite, onAnnounce, hasWriteHandler } = args;
  const [editing, setEditing] = useState<EditingCell | null>(null);

  const start = useCallback(({ rowId, fieldKey, initialValue }: StartArgs) => {
    setEditing({
      rowId,
      fieldKey,
      draftValue: formatClipboardValue(initialValue),
      originalValue: initialValue,
    });
  }, []);

  const draft = useCallback((value: string) => {
    setEditing((current) => (current ? { ...current, draftValue: value } : current));
  }, []);

  const cancel = useCallback(() => setEditing(null), []);

  const isEditingCell = useCallback(
    (rowId: string, fieldKey: string) => editing?.rowId === rowId && editing.fieldKey === fieldKey,
    [editing],
  );

  const commit = useCallback(async (): Promise<boolean> => {
    if (!editing || !hasWriteHandler) return false;
    const fieldDef = fieldDefByKey.get(editing.fieldKey);
    const coerced = coerceFieldValue(editing.draftValue, fieldDef, () => [], {
      emptyNumberValue: 0,
    });
    if (!coerced.ok) {
      onAnnounce(coerced.message);
      return false;
    }
    if (coerced.value === editing.originalValue) {
      setEditing(null);
      return true;
    }
    const cellWrite: CellWrite = {
      rowId: editing.rowId,
      fieldKey: editing.fieldKey,
      value: coerced.value,
    };
    const op: WriteOp = { kind: "cell", writes: [cellWrite] };
    const inverse: WriteOp = {
      kind: "cell",
      writes: [{ rowId: editing.rowId, fieldKey: editing.fieldKey, value: editing.originalValue }],
    };
    try {
      await dispatchWrite(op, inverse);
      onAnnounce(`${fieldDef?.display_name ?? editing.fieldKey} updated.`);
      setEditing(null);
      return true;
    } catch (error) {
      onAnnounce(error instanceof Error ? error.message : "Cell update failed.");
      return false;
    }
  }, [editing, hasWriteHandler, fieldDefByKey, dispatchWrite, onAnnounce]);

  return { editing, isEditingCell, start, draft, commit, cancel };
}

export function isInlineEditableField(fieldDef: FieldDef | undefined): boolean {
  return (
    !fieldDef?.read_only && (fieldDef?.field_type === "text" || fieldDef?.field_type === "number")
  );
}
