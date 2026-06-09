// @size-exception: planning/features/record-linking/phases/phase-01-link-values.md
import { useCallback, useRef, useState } from "react";
import { formatNumberUnitsDisplay, type UnitSystem } from "../../../../lib/units";
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
  | { kind: "single_select"; searchText: string; highlightedOptionId: string | null }
  // linked_record carries no draft state — the LinkedRecordPicker
  // manages its own draft internally and emits the final id list on
  // Confirm, which goes through `commitLinkedRecord` (skipping the
  // text/number `draft` setter entirely).
  | { kind: "linked_record" };

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
  cellError: (rowId: string, fieldKey: string) => string | null;
  isEditingCell: (rowId: string, fieldKey: string) => boolean;
  start: (args: StartArgs) => void;
  // Update the draft string. For text/number this sets draftValue; for
  // single_select this sets searchText.
  draft: (value: string) => void;
  // Update the highlighted option id on a single_select editor. Pass
  // null when the "Create new" footer is the highlight target.
  highlight: (optionId: string | null) => void;
  commit: () => Promise<boolean>;
  // Linked-record picker emits its final id list directly; this skips
  // the draft setter so the picker doesn't have to serialize through a
  // string and back. Returns the same boolean contract as `commit`.
  commitLinkedRecord: (ids: readonly string[]) => Promise<boolean>;
  cancel: () => void;
  queuePendingEdit: (pending: PendingEdit | null) => void;
  consumePendingEdit: (rowIds: string[]) => void;
};

export function useGridEdit(args: {
  fieldDefByKey: Map<string, FieldDef>;
  dispatchWrite: DispatchWrite;
  onAnnounce: (message: string) => void;
  hasWriteHandler: boolean;
  unitSystem?: UnitSystem;
}): GridEdit {
  const { fieldDefByKey, dispatchWrite, onAnnounce, hasWriteHandler, unitSystem = "SI" } = args;
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
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
      const editor = initialEditorState(
        editorKind,
        initialValue,
        intent,
        replaceSeed,
        fieldDef,
        unitSystem,
      );
      if (!editor) return;
      setEditing({ rowId, fieldKey, originalValue: initialValue, editor });
    },
    [fieldDefByKey, unitSystem],
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

  const cellErrorKey = useCallback(
    (rowId: string, fieldKey: string) => `${rowId}\u0000${fieldKey}`,
    [],
  );

  const setCellError = useCallback(
    (rowId: string, fieldKey: string, message: string) => {
      setCellErrors((current) => ({ ...current, [cellErrorKey(rowId, fieldKey)]: message }));
    },
    [cellErrorKey],
  );

  const clearCellError = useCallback(
    (rowId: string, fieldKey: string) => {
      setCellErrors((current) => {
        const key = cellErrorKey(rowId, fieldKey);
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [cellErrorKey],
  );

  const cellError = useCallback(
    (rowId: string, fieldKey: string) => cellErrors[cellErrorKey(rowId, fieldKey)] ?? null,
    [cellErrorKey, cellErrors],
  );

  const isEditingCell = useCallback(
    (rowId: string, fieldKey: string) => editing?.rowId === rowId && editing.fieldKey === fieldKey,
    [editing],
  );

  const commit = useCallback(async (): Promise<boolean> => {
    if (!editing || !hasWriteHandler) return false;
    if (commitInFlightRef.current) return false;
    // §B1 — `commit()` cannot reach the picker's internal draft. If a
    // caller (e.g. `insertRowBelow` via Shift-Enter) tries to commit
    // while a linked_record editor is open, returning `false` without
    // clearing `editing` keeps the picker mounted so the user can
    // Confirm/Cancel explicitly instead of silently losing their
    // selections. The dedicated path is `commitLinkedRecord(ids)`.
    if (editing.editor.kind === "linked_record") {
      return false;
    }
    commitInFlightRef.current = true;
    const fieldDef = fieldDefByKey.get(editing.fieldKey);
    const editor = editing.editor;
    const plan = planCommit(editing, editor, fieldDef, unitSystem);
    try {
      if (plan.kind === "noop") {
        clearCellError(editing.rowId, editing.fieldKey);
        setEditing(null);
        return true;
      }
      if (plan.kind === "invalid") {
        onAnnounce(plan.message);
        setCellError(editing.rowId, editing.fieldKey, plan.message);
        setEditing(null);
        return false;
      }
      await dispatchWrite(plan.op, plan.inverse);
      onAnnounce(`${fieldDef?.display_name ?? "Cell"} updated.`);
      clearCellError(editing.rowId, editing.fieldKey);
      setEditing(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cell update failed.";
      onAnnounce(message);
      setCellError(editing.rowId, editing.fieldKey, message);
      setEditing(null);
      return false;
    } finally {
      commitInFlightRef.current = false;
    }
  }, [
    editing,
    hasWriteHandler,
    fieldDefByKey,
    dispatchWrite,
    onAnnounce,
    unitSystem,
    clearCellError,
    setCellError,
  ]);

  const commitLinkedRecord = useCallback(
    async (ids: readonly string[]): Promise<boolean> => {
      if (!editing || editing.editor.kind !== "linked_record" || !hasWriteHandler) return false;
      if (commitInFlightRef.current) return false;
      commitInFlightRef.current = true;
      const fieldDef = fieldDefByKey.get(editing.fieldKey);
      try {
        const plan = planLinkedRecord(editing, ids, fieldDef);
        if (plan.kind === "noop") {
          clearCellError(editing.rowId, editing.fieldKey);
          setEditing(null);
          return true;
        }
        if (plan.kind === "invalid") {
          onAnnounce(plan.message);
          setCellError(editing.rowId, editing.fieldKey, plan.message);
          setEditing(null);
          return false;
        }
        await dispatchWrite(plan.op, plan.inverse);
        onAnnounce(`${fieldDef?.display_name ?? "Cell"} updated.`);
        clearCellError(editing.rowId, editing.fieldKey);
        setEditing(null);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cell update failed.";
        onAnnounce(message);
        setCellError(editing.rowId, editing.fieldKey, message);
        setEditing(null);
        return false;
      } finally {
        commitInFlightRef.current = false;
      }
    },
    [
      editing,
      hasWriteHandler,
      fieldDefByKey,
      dispatchWrite,
      onAnnounce,
      clearCellError,
      setCellError,
    ],
  );

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
    cellError,
    isEditingCell,
    start,
    draft,
    highlight,
    commit,
    commitLinkedRecord,
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
  unitSystem: UnitSystem,
): CommitPlan {
  if (editor.kind === "single_select") {
    return planSingleSelect(current, editor, fieldDef);
  }
  if (editor.kind === "linked_record") {
    // Linked-record commits flow through `commitLinkedRecord`, not the
    // generic `commit` path — reaching here from the text/number flow
    // means the keyboard handler called commit() on a linked_record
    // editor, which is a no-op.
    return { kind: "noop" };
  }
  return planTextNumberOrColor(current, editor, fieldDef, unitSystem);
}

function planTextNumberOrColor(
  current: EditingCell,
  editor: { kind: "text" | "number" | "color"; draftValue: string },
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem,
): CommitPlan {
  const coerced = coerceFieldValue(editor.draftValue, fieldDef, () => [], { unitSystem });
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

function planLinkedRecord(
  current: EditingCell,
  ids: readonly string[],
  fieldDef: FieldDef | undefined,
): CommitPlan {
  // Dedupe within-cell (mirrors backend `coerce_link_value` — PRD Q25);
  // cap enforcement happens in the backend validator on save, but a
  // single-mode field still UX-wise caps at 1 here.
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  const maxLinks = fieldDef?.linked_record_config?.max_links;
  if (typeof maxLinks === "number" && deduped.length > maxLinks) {
    return {
      kind: "invalid",
      message: `${fieldDef?.display_name ?? current.fieldKey} accepts at most ${maxLinks} link${maxLinks === 1 ? "" : "s"}.`,
    };
  }
  const originalIds = toStringArray(current.originalValue);
  if (sameIdSequence(deduped, originalIds)) return { kind: "noop" };
  const op: WriteOp = {
    kind: "cell",
    writes: [{ rowId: current.rowId, fieldKey: current.fieldKey, value: deduped }],
  };
  const inverse: WriteOp = {
    kind: "cell",
    writes: [{ rowId: current.rowId, fieldKey: current.fieldKey, value: originalIds }],
  };
  return { kind: "dispatch", op, inverse };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) out.push(entry);
  }
  return out;
}

function sameIdSequence(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
  kind: "text" | "number" | "color" | "single_select" | "linked_record" | "none",
  initialValue: unknown,
  intent: EditIntent,
  replaceSeed: string | undefined,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem,
): EditorState | null {
  if (kind === "none") return null;
  if (kind === "linked_record") {
    // The picker reads `initialValue` directly via the cell's
    // `custom_links[fieldKey]` projection — no seed work needed here.
    return { kind: "linked_record" };
  }
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
  // Number+units fields seed the draft with the bare displayed number
  // (canonical SI converted to the active system); commit parses that
  // bare number back through the same unit config — so what the user
  // sees and types matches the cell's rendered text.
  if (intent === "replace") {
    return { kind, draftValue: replaceSeed ?? "" };
  }
  const seed =
    kind === "number" && fieldDef?.numberUnits
      ? formatNumberUnitsDisplay(initialValue, fieldDef.numberUnits, unitSystem)
      : formatClipboardValue(initialValue);
  return { kind, draftValue: seed };
}

// Re-export for callers — single-select cell renderers need to map an
// option id back to its FieldOption for color / label display.
export { singleSelectOption };
