// True when the pointer event's target lives inside an active grid
// editor (inline text/number, color picker, single-select popover) or
// on the fill handle. Shared by:
//   - useGridPointerDrag → short-circuit cell drag while editing.
//   - GridBody contextmenu → fall through to the browser's native
//     menu inside editors / on the fill handle.
//
// Centralizing the class list means adding a new editor type fixes
// both gestures at once.
export function isPointerInActiveEditor(
  target: EventTarget | null,
  args: { editingActive: boolean },
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(".data-table-fill-handle")) return true;
  if (!args.editingActive) return false;
  if (target.closest(".data-table-cell-editor")) return true;
  if (target.closest(".data-table-color-editor")) return true;
  if (target.closest(".single-select-popover")) return true;
  return false;
}
