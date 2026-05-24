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
  isGrouped: boolean;
  onCopy: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRowOpen?: () => void;
  // Shift+Enter row-insert (Phase 2 §4.5). Receives the active rowId
  // as the anchor — null when the active cell does not resolve to a
  // visible row (defensive; should not happen in practice). Returns a
  // promise so the keyboard hook can await a mid-edit commit before
  // requesting the insert.
  onRowInsertBelowActive?: () => Promise<void>;
  // Phase 7: ⌘D fill down / ⌘R fill right. The shell-level callback
  // does the no-op announce when the selection is single-row / single-
  // column, so the keyboard hook always preventDefaults on these two
  // keystrokes whenever the callback is wired — otherwise the browser
  // default (bookmark / reload) wins. When the callback is undefined,
  // the keystroke falls through to the browser.
  onFillDown?: () => Promise<void>;
  onFillRight?: () => Promise<void>;
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
    onRowInsertBelowActive,
    onFillDown,
    onFillRight,
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
        // Phase 7: ⌘D / ⌘R only intercept when the consumer has wired
        // fill. Otherwise the browser default (bookmark / reload) wins.
        if (key === "d" && onFillDown) {
          if (readOnly) return;
          event.preventDefault();
          void onFillDown();
          return;
        }
        if (key === "r" && onFillRight) {
          if (readOnly) return;
          event.preventDefault();
          void onFillRight();
          return;
        }
      }

      if (event.key === "Enter" && event.shiftKey) {
        if (readOnly || !onRowInsertBelowActive) return;
        event.preventDefault();
        void onRowInsertBelowActive();
        return;
      }

      if (event.key === "Enter" && onRowOpen) {
        event.preventDefault();
        onRowOpen();
        return;
      }

      if (ARROW_KEYS.has(event.key)) {
        event.preventDefault();
        selection.moveBy(event.key, event.shiftKey);
      }
    },
    [
      drag,
      edit,
      onCopy,
      onFillDown,
      onFillRight,
      onRedo,
      onRowInsertBelowActive,
      onRowOpen,
      onUndo,
      readOnly,
      selection,
    ],
  );

  return { onKeyDown };
}

function isCommandShortcut(event: KeyboardEvent<HTMLDivElement>): boolean {
  return event.metaKey || event.ctrlKey;
}
