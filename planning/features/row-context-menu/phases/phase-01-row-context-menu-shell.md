---
DATE: 2026-06-04
TIME: 14:30
STATUS: Ready
AUTHOR: Ed May / Claude
SCOPE: RowContextMenu component shell, shared menu keyboard hook,
       shared editor-scope predicate, delegated contextmenu listener,
       single-row Insert / Expand / Delete wired to existing handlers.
       No WriteOp change. No new endpoints.
RELATED:
  - planning/features/row-context-menu/PRD.md §4, §5 rule 3, §10, §12
  - planning/features/row-context-menu/decisions.md D-4, D-7, D-8, D-9
  - frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/components/GridGutter.tsx
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 1 — Row Context Menu shell + single-row built-ins

## P0. Why this slice

Phase 1 is the **library foundation**. It introduces the new menu
component, refactors `HeaderContextMenu` to share keyboard logic, and
hoists the editor-scope predicate — all before any WriteOp / backend
work. By the end of this slice:

- `RowContextMenu.tsx` exists and renders Insert / Expand / Delete
  against a single row via existing handlers
  (`insertRowBelowActive` → `insertRowBelow(anchorRowId)`,
  `onRowOpen`, new `deleteRowById`).
- A shared `useGridMenuKeyboard` hook owns the Arrow / Home / End /
  Esc / focus-restore logic. `HeaderContextMenu` is rewired to use
  it. `RowContextMenu` consumes it from day one.
- A shared `isPointerInActiveEditor` predicate is hoisted out of
  `DataTable.tsx` into `lib/eventTargets.ts`. The pointer-drag hook
  and the new contextmenu hit-test both call it.
- The delegated `contextmenu` listener on `<tbody>` opens the menu;
  viewer mode, `readOnly`, and editor scope fall through to the
  browser's native menu.
- `Shift+F10` / `ContextMenu` key on the focused row's gutter button
  opens the menu at the row's bottom-left.
- Icon + shortcut-hint styling lands via the
  `data-table-column-menu-item--with-icon` modifier.

Phase 1 does **not** ship Duplicate, multi-row collapse, or the
`rowActions` slot. Those land in Phases 3a and 2 / 4 respectively.

## P1. Acceptance — Phase 1 done when

1. Right-clicking any data row in the materials catalog opens a menu
   with **Insert record · Expand record · Delete record**. Each item
   has its lucide icon and works.
2. `Insert record` creates a blank row below the right-clicked row
   and focuses the first editable cell (identical to Shift+Enter).
3. `Expand record` opens the per-row attribute modal (identical to
   clicking the gutter expand icon). The item is hidden when the
   consumer omits `onRowOpen`.
4. `Delete record` deletes only the right-clicked row. ⌘Z restores
   it.
5. Viewer mode and `readOnly` surfaces fall through to the browser's
   native context menu.
6. Right-clicking inside an open `InlineCellEditor`, color editor,
   single-select popover, or the fill handle does **not** open the
   row menu.
7. `Shift+F10` / `ContextMenu` key on a focused row's gutter button
   opens the menu at the row's bottom-left. Arrow / Home / End / Esc
   work; Esc restores focus to the gutter button.
8. `HeaderContextMenu` continues to behave identically after
   adopting `useGridMenuKeyboard` (existing
   `HeaderContextMenu.test.tsx` suite passes unchanged plus new
   hook-level cases).
9. `make ci` is green.

## P2. Files

### New

- `frontend/src/shared/ui/data-table/components/RowContextMenu.tsx`
- `frontend/src/shared/ui/data-table/hooks/useGridMenuKeyboard.ts`
- `frontend/src/shared/ui/data-table/lib/eventTargets.ts`
- `frontend/src/shared/ui/data-table/__tests__/RowContextMenu.test.tsx`
- `frontend/src/shared/ui/data-table/__tests__/useGridMenuKeyboard.test.ts`
- `frontend/tests/e2e/row-context-menu-shell.spec.ts` — covers
  acceptance items 5–7 (viewer fallthrough, editor scope, keyboard).

### Modified

- `frontend/src/shared/ui/data-table/components/HeaderContextMenu.tsx`
  — adopt `useGridMenuKeyboard`; drop the inlined focus manager.
- `frontend/src/shared/ui/data-table/components/GridBody.tsx` — add
  the delegated `contextmenu` listener on `<tbody>` (or hoisted to
  the `<tr>` via the existing `data-row-id` attribute).
- `frontend/src/shared/ui/data-table/DataTable.tsx`:
  - Rename `insertRowBelowActive` → `insertRowBelow(anchorRowId)`;
    Shift+Enter calls it with the current active row's id.
  - Add `deleteRowById(rowId)` (same body as `deleteSelectedRows`
    but scoped to a single id).
  - Pass `onRowOpen` (existing prop) to the new menu surface.
  - Move `isPointerInActiveEditor` body into the new
    `lib/eventTargets.ts` and import it; `useGridPointerDrag`
    consumers swap to the import.
  - Wire the new menu's `triggerRef` per row from `GridBody`.
- `frontend/src/shared/ui/data-table/DataTable.css` — add the
  `data-table-column-menu-item--with-icon` modifier and the right-
  aligned shortcut-hint span style.

## P3. Component shapes

### `RowContextMenu.tsx`

```ts
export type RowContextMenuProps = {
  rowId: string;
  rowNumber: number;
  // Frozen at right-click time — see PRD §5 render-perf contract.
  selectionCount: number;
  rowIsInSelection: boolean;
  onInsertBelow: () => void;
  onOpen?: () => void;            // hidden when undefined
  onDelete: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  isViewer: boolean;
  // Phase 2 adds `onDeleteSelection: () => void` + collapse logic.
  // Phase 3a adds `onDuplicate: () => void`.
  // Phase 4 adds `customActions: RowAction[]`.
};
```

Body mirrors `HeaderContextMenu.tsx`:

- `useState<OpenState | null>` with `{ x, y, activeIndex }`.
- `useEffect` to install the `contextmenu` listener on `triggerRef`.
  (Phase 1 keeps the listener installation inside the menu component
  to mirror `HeaderContextMenu` — a future refactor can consolidate.)
- `useGridMenuKeyboard({ itemCount })` for Arrow / Home / End and
  the `itemRefs` array.
- Radix `<Popover.Root>` + `Popover.Anchor` (via `pointAnchorRef`)
  + `Popover.Portal` + `Popover.Content` (`role="menu"`,
  `aria-label="Row {rowNumber} actions"`).
- Per-item `<button role="menuitem"
  className="data-table-column-menu-item data-table-column-menu-item--with-icon"
  data-danger={...}>` with `[icon][label][shortcutHint]` slots.

### `useGridMenuKeyboard.ts`

Extracted verbatim from the focus manager currently inlined in
`HeaderContextMenu.tsx`:

```ts
export function useGridMenuKeyboard(args: {
  itemCount: number;
  initialIndex?: number;
}): {
  activeIndex: number;
  setActiveIndex: (next: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  resetToInitial: () => void;
} {
  // ArrowDown: (i + 1) % n
  // ArrowUp:   (i - 1 + n) % n
  // Home:      0
  // End:       n - 1
  // useEffect: itemRefs.current[activeIndex]?.focus() on change
}
```

The hook does **not** own the open/closed state, the Radix popover, or
the `contextmenu` listener installation — those stay in the consuming
menu component. The hook is the focus/keyboard concern only.

### `lib/eventTargets.ts`

```ts
/**
 * True when the pointer event's target lives inside an active grid
 * editor (inline text/number, color picker, single-select popover) or
 * on the fill handle. Used by:
 *   - useGridPointerDrag → short-circuit cell drag while editing.
 *   - GridBody contextmenu → fall through to the browser's native
 *     menu inside editors.
 *
 * Centralizing the class-list here means adding a new editor type
 * fixes both gestures at once.
 */
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
```

Note: the existing predicate in `DataTable.tsx` closes over
`edit.editing`; the hoisted version takes that as an `editingActive`
flag so the predicate is pure and unit-testable.

### Trigger surface — `GridBody.tsx`

```tsx
const handleTbodyContextMenu = (event: ReactMouseEvent<HTMLTableSectionElement>) => {
  if (isViewerOrReadOnly) return;                      // fall through
  const target = event.target as HTMLElement;
  if (isPointerInActiveEditor(target, { editingActive: Boolean(edit.editing) })) return;
  if (target.closest("input.data-table-gutter-checkbox")) return;
  const tr = target.closest<HTMLTableRowElement>("tr[data-row-id]");
  if (!tr) return;
  const rowId = tr.dataset.rowId!;
  event.preventDefault();
  openRowMenu({ rowId, x: event.clientX, y: event.clientY });
};
```

Add `data-row-id` to each `<tr>` (currently only on `<td>`s). One
attribute on the row is cleaner than reading the first cell's
attribute.

### Keyboard trigger — `GridGutter.tsx`

The gutter's number button (`tabIndex={-1}` today — we keep it that
way) hosts a `Shift+F10` / `ContextMenu` keydown listener that
delegates to the same `openRowMenu` call with the row's
`getBoundingClientRect().bottom`-left anchor. Match
`HeaderContextMenu`'s keyboard handler verbatim.

## P4. Sequence

1. Land `useGridMenuKeyboard` + its unit tests. Rewire
   `HeaderContextMenu` to use it. `HeaderContextMenu.test.tsx` is
   the regression net; add 2-3 cases to the hook test for
   wraparound + initial-index resets.
2. Land `lib/eventTargets.ts` + its unit tests. Update
   `DataTable.tsx::isPointerInActiveEditor` callsite and any
   `useGridPointerDrag` callsite.
3. Land `RowContextMenu.tsx` skeleton (Insert / Expand / Delete
   only). Stub `onDuplicate` / `customActions` / collapse — they
   land in 2 / 3a / 4.
4. Refactor `insertRowBelowActive` → `insertRowBelow(anchorRowId)`
   in `DataTable.tsx`. Add `deleteRowById(rowId)`. Wire both to the
   new menu through props passed down to `GridBody`.
5. Add the delegated `contextmenu` handler on `<tbody>` and the
   keyboard handler on the gutter number button.
6. CSS: add the `--with-icon` modifier; verify spacing matches the
   existing column menu items.
7. e2e: viewer fallthrough, editor-scope suppression, Shift+F10.

## P5. Tests

### Vitest

- `useGridMenuKeyboard.test.ts` — wraparound, Home / End, initial
  index, `resetToInitial`.
- `RowContextMenu.test.tsx` — renders three items when `onOpen` is
  defined; renders two items when it's not; viewer mode renders
  null; `data-danger` on Delete; keyboard navigation; Esc restores
  focus.
- Augment `HeaderContextMenu.test.tsx` only if existing tests fail
  after the rewire (they should not — `useGridMenuKeyboard` mirrors
  the existing focus manager line-by-line).

### Playwright e2e — `row-context-menu-shell.spec.ts`

- Viewer mode: right-click renders the browser's native menu (no
  custom menu in the DOM). Assert by absence of the
  `data-table-column-menu` selector after `contextmenu`.
- Editor scope: open the InlineCellEditor on a cell, right-click
  inside the editor, assert no menu opens.
- Keyboard: focus the gutter button, press `Shift+F10`, assert
  menu opens; press Esc, assert focus returns.

### Backend

None (Phase 1 has no backend work).

## P6. Out of scope (lands in later phases)

- `Duplicate record` menu item and the `rowDuplicate` WriteOp →
  Phase 3a.
- Multi-row `Delete N records` collapse → Phase 2.
- `rowActions` slot → Phase 4.
- Adding icons to existing header context menu items → out of scope
  (mentioned in PRD §12 as future polish).

## P7. Risks

- **`HeaderContextMenu` rewire is the highest-risk part of this
  phase.** The hook extraction must be byte-for-byte equivalent in
  behavior or the existing header menu regresses. Mitigation: read
  the existing focus-manager code line-by-line into the hook;
  re-run `HeaderContextMenu.test.tsx` after each step.
- **`data-row-id` on `<tr>`.** Today only `<td>` carries it. Adding
  it to `<tr>` is harmless but touches every test that asserts the
  `<tr>` markup. Mitigation: search-and-update — likely 0-3
  callsites.
- **`isPointerInActiveEditor` signature change.** The hoisted
  version takes `editingActive` as an explicit arg rather than
  closing over `edit.editing`. The pointer-drag callsite needs to
  pass it. Mitigation: TypeScript will surface the missing arg at
  the existing callsite; no runtime risk.
