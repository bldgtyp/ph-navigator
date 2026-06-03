import { useCallback, useRef, useState } from "react";
import { coerceFieldValue } from "../lib/rows/defaults";
import { createFieldOption } from "../lib/options/create";
import { findFieldOptionByLabel } from "../lib/options/references";
import { formatClipboardValue } from "../lib/paste/tsv";
import { singleSelectOption } from "../lib/rows/format";
import { getFieldEditor } from "../fields/registry";
import type { CellWrite, FieldDef, FieldOption, WriteOp } from "../types";
import type { DispatchWrite } from "./useGridWriteReducer";

// Inline edit lifecycle. Phase 1 generalizes the draft into a typed
// discriminated union so single_select can carry its own search-text +
// highlight state alongside the text/number draft string. The shape is
// the seed for further editor kinds (multi-select, date, etc.).
//
// The single-select commit path emits one semantic WriteOp containing
// both the cell write AND any newly-created option, with the inverse
// op carrying the matching removedOptions — PoC L6.5 (one op per
// gesture, undo reverts both halves together).
export type EditorState =
  | { kind: "text"; draftValue: string }
  | { kind: "number"; draftValue: string }
  | { kind: "color"; draftValue: string }
  | { kind: "single_select"; searchText: string; highlightedOptionId: string | null };

export type EditingCell = {
  rowId: string;
  fieldKey: string;
  originalValue: unknown;
  editor: EditorState;
};

export type EditIntent = "replace" | "extend";

export type StartArgs = {
  rowId: string;
  fieldKey: string;
  initialValue: unknown;
  intent: EditIntent;
  // Seed the text/number draft when `intent === "replace"` so a
  // type-to-edit gesture lands in the editor with the typed character
  // instead of the prior cell value. Ignored for prefill
  // (`intent === "extend"`) and for the single_select editor.
  replaceSeed?: string;
};

// One-shot focus handoff used by the Shift+Enter row-insert flow
// (Phase 2 §4.4). Queued before the rowInsert op is dispatched; the
// shell calls consumePendingEdit once the new row appears in the
// current render's rowIds. If the row never appears within a single
// useEffect cycle, the entry is dropped silently.
export type PendingEdit = {
  rowId: string;
  fieldKey: string;
  initialValue: unknown;
};

export type GridEdit = {
  editing: EditingCell | null;
  isEditingCell: (rowId: string, fieldKey: string) => boolean;
  start: (args: StartArgs) => void;
  // Update the draft string. For text/number this sets draftValue; for
  // single_select this sets searchText.
  draft: (value: string) => void;
  // Update the highlighted option id on a single_select editor. Pass
  // null when the "Create new" footer is the highlight target.
  highlight: (optionId: string | null) => void;
  commit: () => Promise<boolean>;
  cancel: () => void;
  queuePendingEdit: (pending: PendingEdit | null) => void;
  consumePendingEdit: (rowIds: string[]) => void;
};

export function useGridEdit(args: {
  fieldDefByKey: Map<string, FieldDef>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  hasWriteHandler: boolean;
}): GridEdit {
  const { fieldDefByKey, dispatchWrite, onAnnounce, hasWriteHandler } = args;
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const pendingRef = useRef<PendingEdit | null>(null);
  const commitInFlightRef = useRef(false);
  // Tracks the rowIds identity we last saw so a queued pending entry
  // gets one render to resolve. If the next render does not contain
  // the queued rowId, the entry is dropped.
  const pendingRowsRef = useRef<string[] | null>(null);

  const start = useCallback(
    ({ rowId, fieldKey, initialValue, intent, replaceSeed }: StartArgs) => {
      const fieldDef = fieldDefByKey.get(fieldKey);
      const editorKind = getFieldEditor(fieldDef).kind;
      const editor = initialEditorState(editorKind, initialValue, intent, replaceSeed);
      if (!editor) return;
      setEditing({ rowId, fieldKey, originalValue: initialValue, editor });
    },
    [fieldDefByKey],
  );

  const draft = useCallback((value: string) => {
    setEditing((current) => {
      if (!current) return current;
      const editor = current.editor;
      if (editor.kind === "single_select") {
        return { ...current, editor: { ...editor, searchText: value } };
      }
      return { ...current, editor: { ...editor, draftValue: value } };
    });
  }, []);

  const highlight = useCallback((optionId: string | null) => {
    setEditing((current) => {
      if (!current || current.editor.kind !== "single_select") return current;
      return { ...current, editor: { ...current.editor, highlightedOptionId: optionId } };
    });
  }, []);

  const cancel = useCallback(() => setEditing(null), []);

  const isEditingCell = useCallback(
    (rowId: string, fieldKey: string) => editing?.rowId === rowId && editing.fieldKey === fieldKey,
    [editing],
  );

  const commit = useCallback(async (): Promise<boolean> => {
    if (!editing || !hasWriteHandler) return false;
    if (commitInFlightRef.current) return false;
    commitInFlightRef.current = true;
    const fieldDef = fieldDefByKey.get(editing.fieldKey);
    const editor = editing.editor;
    const plan = planCommit(editing, editor, fieldDef);
    try {
      if (plan.kind === "noop") {
        setEditing(null);
        return true;
      }
      if (plan.kind === "invalid") {
        onAnnounce(plan.message);
        return false;
      }
      await dispatchWrite(plan.op, plan.inverse);
      onAnnounce(`${fieldDef?.display_name ?? "Cell"} updated.`);
      setEditing(null);
      return true;
    } catch (error) {
      onAnnounce(error instanceof Error ? error.message : "Cell update failed.");
      return false;
    } finally {
      commitInFlightRef.current = false;
    }
  }, [editing, hasWriteHandler, fieldDefByKey, dispatchWrite, onAnnounce]);

  const queuePendingEdit = useCallback((pending: PendingEdit | null) => {
    pendingRef.current = pending;
    pendingRowsRef.current = null;
  }, []);

  const consumePendingEdit = useCallback(
    (rowIds: string[]) => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (rowIds.includes(pending.rowId)) {
        pendingRef.current = null;
        pendingRowsRef.current = null;
        start({
          rowId: pending.rowId,
          fieldKey: pending.fieldKey,
          initialValue: pending.initialValue,
          intent: "replace",
        });
        return;
      }
      // Give the entry one render to land. If a second different
      // rowIds identity arrives without the queued rowId in it, drop.
      if (pendingRowsRef.current === null) {
        pendingRowsRef.current = rowIds;
      } else if (pendingRowsRef.current !== rowIds) {
        pendingRef.current = null;
        pendingRowsRef.current = null;
      }
    },
    [start],
  );

  return {
    editing,
    isEditingCell,
    start,
    draft,
    highlight,
    commit,
    cancel,
    queuePendingEdit,
    consumePendingEdit,
  };
}

// Pure planner: turn the current editor state into a forward/inverse op
// pair, a no-op signal, or a validation message. Kept outside the
// component so React-hooks lint sees no surprise closure deps and so
// the planner is directly unit-testable.
type CommitPlan =
  | { kind: "noop" }
  | { kind: "invalid"; message: string }
  | { kind: "dispatch"; op: WriteOp; inverse: WriteOp };

function planCommit(
  current: EditingCell,
  editor: EditorState,
  fieldDef: FieldDef | undefined,
): CommitPlan {
  if (editor.kind === "single_select") {
    return planSingleSelect(current, editor, fieldDef);
  }
  return planTextNumberOrColor(current, editor, fieldDef);
}

function planTextNumberOrColor(
  current: EditingCell,
  editor: { kind: "text" | "number" | "color"; draftValue: string },
  fieldDef: FieldDef | undefined,
): CommitPlan {
  const coerced = coerceFieldValue(editor.draftValue, fieldDef, () => []);
  if (!coerced.ok) return { kind: "invalid", message: coerced.message };
  if (coerced.value === current.originalValue) return { kind: "noop" };
  const op: WriteOp = {
    kind: "cell",
    writes: [{ rowId: current.rowId, fieldKey: current.fieldKey, value: coerced.value }],
  };
  const inverse: WriteOp = {
    kind: "cell",
    writes: [{ rowId: current.rowId, fieldKey: current.fieldKey, value: current.originalValue }],
  };
  return { kind: "dispatch", op, inverse };
}

function planSingleSelect(
  current: EditingCell,
  editor: { kind: "single_select"; searchText: string; highlightedOptionId: string | null },
  fieldDef: FieldDef | undefined,
): CommitPlan {
  const options = fieldDef?.options ?? [];
  const decision = decideSingleSelectCommit(editor, options);
  if (decision.kind === "noop") return { kind: "noop" };
  if (decision.kind === "blank") {
    return {
      kind: "invalid",
      message: `${fieldDef?.display_name ?? current.fieldKey} requires a value.`,
    };
  }
  if (decision.kind === "existing" && decision.optionId === current.originalValue) {
    return { kind: "noop" };
  }
  const created = decision.kind === "create" ? decision.created : null;
  const op: WriteOp = {
    kind: "cell",
    writes: [{ rowId: current.rowId, fieldKey: current.fieldKey, value: decision.optionId }],
    ...(created ? { newOptions: { [current.fieldKey]: [created] } } : {}),
  };
  const inverseWrites: CellWrite[] = [
    { rowId: current.rowId, fieldKey: current.fieldKey, value: current.originalValue },
  ];
  const inverse: WriteOp = {
    kind: "cell",
    writes: inverseWrites,
    ...(created ? { removedOptions: { [current.fieldKey]: [created.id] } } : {}),
  };
  return { kind: "dispatch", op, inverse };
}

// Decide what a single-select commit() resolves to given the current
// editor state. Pure so it can be unit-tested without React.
export type SingleSelectCommitDecision =
  | { kind: "noop" } // selection unchanged
  | { kind: "blank" } // user tried to commit empty when required-by-popover (not currently reachable)
  | { kind: "existing"; optionId: string }
  | { kind: "create"; optionId: string; created: FieldOption };

function decideSingleSelectCommit(
  editor: { searchText: string; highlightedOptionId: string | null },
  options: FieldOption[],
): SingleSelectCommitDecision {
  if (editor.highlightedOptionId !== null) {
    return { kind: "existing", optionId: editor.highlightedOptionId };
  }
  const trimmed = editor.searchText.trim();
  if (!trimmed) return { kind: "noop" };
  const existing = findFieldOptionByLabel(options, trimmed);
  if (existing) return { kind: "existing", optionId: existing.id };

  const created = createFieldOption(trimmed, options);
  return { kind: "create", optionId: created.id, created };
}

function initialEditorState(
  kind: "text" | "number" | "color" | "single_select" | "none",
  initialValue: unknown,
  intent: EditIntent,
  replaceSeed: string | undefined,
): EditorState | null {
  if (kind === "none") return null;
  if (kind === "single_select") {
    // Plan 05: type-to-edit on a single-select cell pre-fills the
    // popover's search input with the typed character so the list
    // filters immediately. With a seed present we drop the prior-
    // value highlight (the cycle effect will snap to the first
    // filtered option); with no seed (Enter / F2 / Space, or any
    // `extend` start) we highlight the existing value.
    const seed = intent === "replace" ? (replaceSeed ?? "") : "";
    return {
      kind: "single_select",
      searchText: seed,
      highlightedOptionId:
        seed.length > 0 ? null : typeof initialValue === "string" ? initialValue : null,
    };
  }
  const seed = intent === "replace" ? (replaceSeed ?? "") : formatClipboardValue(initialValue);
  return { kind, draftValue: seed };
}

// Re-export for callers — single-select cell renderers need to map an
// option id back to its FieldOption for color / label display.
export { singleSelectOption };
