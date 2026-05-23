import { useCallback, useState } from "react";
import {
  coerceFieldValue,
  createFieldOption,
  findFieldOptionByLabel,
  formatClipboardValue,
  singleSelectOption,
} from "../lib";
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
};

export function useGridEdit(args: {
  fieldDefByKey: Map<string, FieldDef>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  hasWriteHandler: boolean;
}): GridEdit {
  const { fieldDefByKey, dispatchWrite, onAnnounce, hasWriteHandler } = args;
  const [editing, setEditing] = useState<EditingCell | null>(null);

  const start = useCallback(
    ({ rowId, fieldKey, initialValue, intent }: StartArgs) => {
      const fieldDef = fieldDefByKey.get(fieldKey);
      const editorKind = getFieldEditor(fieldDef).kind;
      const editor = initialEditorState(editorKind, initialValue, intent);
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
    const fieldDef = fieldDefByKey.get(editing.fieldKey);
    const editor = editing.editor;
    const plan = planCommit(editing, editor, fieldDef);
    if (plan.kind === "noop") {
      setEditing(null);
      return true;
    }
    if (plan.kind === "invalid") {
      onAnnounce(plan.message);
      return false;
    }
    try {
      await dispatchWrite(plan.op, plan.inverse);
      onAnnounce(`${fieldDef?.display_name ?? "Cell"} updated.`);
      setEditing(null);
      return true;
    } catch (error) {
      onAnnounce(error instanceof Error ? error.message : "Cell update failed.");
      return false;
    }
  }, [editing, hasWriteHandler, fieldDefByKey, dispatchWrite, onAnnounce]);

  return { editing, isEditingCell, start, draft, highlight, commit, cancel };
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
  return planTextOrNumber(current, editor, fieldDef);
}

function planTextOrNumber(
  current: EditingCell,
  editor: { kind: "text" | "number"; draftValue: string },
  fieldDef: FieldDef | undefined,
): CommitPlan {
  const coerced = coerceFieldValue(editor.draftValue, fieldDef, () => [], {
    emptyNumberValue: 0,
  });
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
  kind: "text" | "number" | "single_select" | "none",
  initialValue: unknown,
  intent: EditIntent,
): EditorState | null {
  if (kind === "none") return null;
  if (kind === "single_select") {
    return {
      kind: "single_select",
      searchText: intent === "replace" ? "" : "",
      highlightedOptionId: typeof initialValue === "string" ? initialValue : null,
    };
  }
  const seed = intent === "replace" ? "" : formatClipboardValue(initialValue);
  return { kind, draftValue: seed };
}

// Re-export for callers — single-select cell renderers need to map an
// option id back to its FieldOption for color / label display.
export { singleSelectOption };
