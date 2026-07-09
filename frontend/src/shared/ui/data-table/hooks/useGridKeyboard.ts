import { useCallback, type KeyboardEvent } from "react";
import type { GridSelection } from "./useGridSelection";
import type { GridEdit } from "./useGridEdit";

// The keyboard hook is the only place that touches DOM events; every
// other hook is reducer-shaped. Phase 0 surface: arrow nav, Tab/Home/End,
// ⌘A, ⌘C, ⌘Z / ⌘⇧Z, Enter (row open).
//
// ⌘V is intentionally NOT handled here. Calling preventDefault() on a
// ⌘V keydown suppresses the browser's subsequent paste event, which
// breaks the system clipboard read path (clipboardData.getData). The
// native paste event is handled by the wrapper's onPaste in DataTable.tsx
// (PoC L4.1 — native clipboard events, not keydown intercepts).

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

export type GridKeyboardArgs = {
  selection: GridSelection;
  edit: GridEdit;
  readOnly: boolean;
  onCopy: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRowOpen?: () => void;
  // Plan 04 — type-to-edit. F2 (and Enter, when wired) open the inline
  // editor on the active cell with the cell's prior value prefilled
  // ("edit, don't replace"). When the active cell is not editable,
  // `onBeginEdit` falls through to `onRowOpen` inside the shell.
  onBeginEdit?: () => void;
  // A printable character typed while no editor is open replaces the
  // active cell's value and enters edit mode.
  // The shell-level handler gates further (read-only, single-select
  // routing, multi-cell announce) — the keyboard hook only checks that
  // the keystroke is a single printable char with no modifiers and not
  // an IME composition.
  onPrintableKey?: (key: string) => void;
  // Backspace / Delete on the active cell asks the shell to clear the
  // value. The shell enforces nullable-field and write-handler gates.
  onClearActiveCell?: () => void;
  // Shift+Enter row-insert (Phase 2 §4.5). Receives the active rowId
  // as the anchor — null when the active cell does not resolve to a
  // visible row (defensive; should not happen in practice). Returns a
  // promise so the keyboard hook can await a mid-edit commit before
  // requesting the insert.
  onRowInsertBelowActive?: () => Promise<void>;
  // ⌘D / ⌘R fill down / right and ⌘⇧D / ⌘⇧R fill up / left. The
  // shell-level callback announces the no-op when the selection is
  // single-row / single-column; the keyboard hook always preventDefaults
  // when the matching callback is wired so the browser's default
  // (bookmark / reload / hard-reload for ⌘⇧R on Chrome / Safari) loses.
  // When the matching callback is undefined the keystroke falls through.
  onFillDown?: () => Promise<void>;
  onFillRight?: () => Promise<void>;
  onFillUp?: () => Promise<void>;
  onFillLeft?: () => Promise<void>;
  onClearCopiedRange?: () => void;
  hasCopiedRange?: boolean;
  // Phase 3 §4.4: Esc during an active drag cancels the drag and
  // collapses the range to the drag anchor. Optional — when no drag
  // composition is wired, Esc keeps its prior no-op behavior.
  drag?: { isDragging: boolean; cancel: () => void };
};

export function useGridKeyboard(args: GridKeyboardArgs) {
  const {
    selection,
    edit,
    readOnly,
    onCopy,
    onUndo,
    onRedo,
    onRowOpen,
    onBeginEdit,
    onPrintableKey,
    onClearActiveCell,
    onRowInsertBelowActive,
    onFillDown,
    onFillRight,
    onFillUp,
    onFillLeft,
    onClearCopiedRange,
    hasCopiedRange = false,
    drag,
  } = args;

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return;
      // Esc cancels an active pointer drag before any other handling,
      // so the keystroke works even mid-drag with the wrapper focused.
      if (event.key === "Escape" && drag?.isDragging) {
        event.preventDefault();
        drag.cancel();
        return;
      }
      if (event.key === "Escape" && hasCopiedRange && onClearCopiedRange) {
        event.preventDefault();
        onClearCopiedRange();
        return;
      }
      // Edit-mode hands off all keystrokes to InlineCellEditor; the grid
      // shell ignores everything until the edit closes.
      if (edit.editing) return;

      if (isCommandShortcut(event)) {
        const key = event.key.toLowerCase();
        if (key === "c") {
          event.preventDefault();
          onCopy();
          return;
        }
        // ⌘V is deliberately NOT intercepted — see comment above.
        if (key === "z") {
          if (readOnly) return;
          event.preventDefault();
          if (event.shiftKey) onRedo();
          else onUndo();
          return;
        }
        if (key === "a") {
          event.preventDefault();
          selection.selectAll();
          return;
        }
        // ⌘D / ⌘R / ⌘⇧D / ⌘⇧R only intercept when the matching fill
        // callback is wired — otherwise the keystroke falls through to
        // the browser default (bookmark / reload / hard reload).
        const fillCallback = pickFillCallback(key, event.shiftKey, {
          onFillDown,
          onFillUp,
          onFillRight,
          onFillLeft,
        });
        if (fillCallback) {
          if (readOnly) return;
          event.preventDefault();
          void fillCallback();
          return;
        }
      }

      if (event.key === "Enter" && event.shiftKey) {
        if (readOnly || !onRowInsertBelowActive) return;
        event.preventDefault();
        void onRowInsertBelowActive();
        return;
      }

      // F2 opens the inline editor with the prior cell value prefilled.
      // The shell-level handler decides whether to fall through to
      // onRowOpen when the active cell is not editable.
      if (event.key === "F2" && onBeginEdit) {
        event.preventDefault();
        onBeginEdit();
        return;
      }

      // Enter prefers the inline editor (Excel/AirTable parity, plan 04).
      // The shell's onBeginEdit falls through to onRowOpen for non-editable
      // cells, preserving the row-detail gesture when the active cell has
      // no inline editor.
      if (event.key === "Enter") {
        if (onBeginEdit) {
          event.preventDefault();
          onBeginEdit();
          return;
        }
        if (onRowOpen) {
          event.preventDefault();
          onRowOpen();
          return;
        }
      }

      if (ARROW_KEYS.has(event.key)) {
        event.preventDefault();
        selection.moveBy(event.key, event.shiftKey);
        return;
      }

      // Backspace / Delete on the active cell clears nullable fields.
      // The shell's handler enforces editable-cell and write-handler
      // gates.
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        onClearActiveCell
      ) {
        event.preventDefault();
        onClearActiveCell();
        return;
      }

      // Printable single-character keystroke with no modifiers and no
      // IME composition → route to the type-to-edit handler. The shell
      // applies the range-collapse / read-only / single-select gates.
      // `isComposing` lives on the native KeyboardEvent, not React's
      // synthetic event wrapper.
      if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.nativeEvent.isComposing &&
        onPrintableKey
      ) {
        event.preventDefault();
        onPrintableKey(event.key);
        return;
      }
    },
    [
      drag,
      edit,
      onBeginEdit,
      onClearActiveCell,
      onCopy,
      onFillDown,
      onFillLeft,
      onFillRight,
      onFillUp,
      onClearCopiedRange,
      onPrintableKey,
      onRedo,
      onRowInsertBelowActive,
      onRowOpen,
      onUndo,
      readOnly,
      selection,
      hasCopiedRange,
    ],
  );

  return { onKeyDown };
}

function isCommandShortcut(event: KeyboardEvent<HTMLDivElement>): boolean {
  return event.metaKey || event.ctrlKey;
}

type FillCallback = () => Promise<void>;

function pickFillCallback(
  key: string,
  shiftKey: boolean,
  callbacks: {
    onFillDown?: FillCallback;
    onFillUp?: FillCallback;
    onFillRight?: FillCallback;
    onFillLeft?: FillCallback;
  },
): FillCallback | undefined {
  if (key === "d") return shiftKey ? callbacks.onFillUp : callbacks.onFillDown;
  if (key === "r") return shiftKey ? callbacks.onFillLeft : callbacks.onFillRight;
  return undefined;
}
