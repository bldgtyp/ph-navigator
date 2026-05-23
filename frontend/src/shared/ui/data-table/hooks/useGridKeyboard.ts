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
};

export function useGridKeyboard(args: GridKeyboardArgs) {
  const { selection, edit, readOnly, onCopy, onUndo, onRedo, onRowOpen } = args;

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return;
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
    [edit, onCopy, onRedo, onRowOpen, onUndo, readOnly, selection],
  );

  return { onKeyDown };
}

function isCommandShortcut(event: KeyboardEvent<HTMLDivElement>): boolean {
  return event.metaKey || event.ctrlKey;
}
