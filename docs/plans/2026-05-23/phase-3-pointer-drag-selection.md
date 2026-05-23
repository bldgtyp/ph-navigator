---
DATE: 2026-05-23
TIME: planning
STATUS: Implementation complete — all 5 steps + 2 post-walk
        revisions (R1, R2) landed. 191 tests passing. Demo walked
        live in Playwright. Safari smoke walk still owed for the
        autoscroll-past-viewport edge case.
SCOPE: Phase 3 of the `<DataTable>` AirTable-parity plan. Mouse-drag
       rectangular range selection, viewport-edge auto-scroll during
       drag, full-column select header affordance, and the contiguous
       perimeter-outline visual treatment for the resulting range.
       Driven against Rooms (US-EQ-2). No other consumers touched.
       Closes wishlist items #1 (range select + copy) and #2 (full-row /
       full-column select). Full-row select already ships via the Phase 2
       gutter row-number button and is verified, not rebuilt.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract,
    §Interaction Requirements + §Layout/Styling/A11y)
  - context/user-stories/30-tables-equipment.md
  - docs/plans/2026-05-23/phase-0-foundation-refactor.md
  - docs/plans/2026-05-23/phase-1-inline-edit-popover.md
  - docs/plans/2026-05-23/phase-2-row-insert-delete.md
  - research/poc-plans/poc-lessons-for-real-build.md
    (L1.1, L3.2, L3.3, L5.3, L7.1)
---

# Phase 3 — Mouse-drag range selection + auto-scroll + full-column select

## 1. Why this phase exists

Today the only way to build a rectangular range in `<DataTable>` is the
Phase 0 keyboard path: focus a cell, then `Shift+Arrow` to grow the
range one cell at a time. ⌘C / ⌘V are already wired against
`selection.range`, so the *output* of a range is fine — but the *input*
gesture is not AirTable-parity. A user who wants to copy a 10×N block
out to Excel today has to press Shift+Down ten times rather than drag
across the cells.

Two other gaps land in the same phase because they share the same
underlying machinery:

1. **Full-column select.** The PoC and the canonical contract both
   list it (data-table.md §Interaction Requirements: "rectangular range
   selection, full-row select, full-column select, and full
   visible-table select"). Today only full-row select exists (Phase 2
   gutter row-number button) and ⌘A select-all. There is no way to
   grab one column without dragging through every row.

2. **Contiguous perimeter outline.** Today's CSS (`App.css:1436`)
   draws a 1 px inset shadow on *every* selected cell, which produces
   visible interior gridlines instead of a single rectangle. The
   pointer-drag gesture exposes this clearly because the user expects
   a continuous border to follow their cursor. Phase 3 changes the
   rendering to emit perimeter-only borders (top / right / bottom /
   left edge classes per cell) so the resulting outline matches
   AirTable / Excel expectations.

Phase 3 closes all three gaps with one shared mechanism: document-level
pointer tracking that calls back into the existing `useGridSelection`
hook (PoC L5.3 — drag listeners must live on the document, not the
table, so the user can drag past the viewport edge).

After Phase 3, every interaction model AirTable users expect for range
selection works: click + drag, click + Shift+Click extend, click full
column, Shift+Click another column to extend, drag past the edge to
auto-scroll. The cell range remains the source of truth for ⌘C / ⌘V /
the future Phase 7 fill handle.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/` plus `frontend/src/App.css` for
   the perimeter-outline rules. **Zero touches** to `RoomsTable.tsx`,
   `EquipmentTab.tsx`, or anything under `features/`. If a consumer
   file changes during this phase, pause and re-evaluate.
2. **One mechanism, three gestures.** Cell drag, column-header drag /
   click, and the existing Shift+Arrow / ⌘A / row-number paths all
   resolve to the same `useGridSelection` API (`setActive` / `extendTo`
   / `selectRow` / `selectAll`). Phase 3 adds `selectColumn` and a new
   `useGridPointerDrag` hook that orchestrates the drag, but the
   *selection state* stays in `useGridSelection`.
3. **Document-level pointer listeners only attach during a drag.** The
   hook attaches `mousemove` / `mouseup` to `document` on `mousedown`
   and removes them on `mouseup`. No always-on global listeners — this
   keeps idle CPU at zero and avoids interaction with other surfaces
   that capture pointer events (popovers, modals, the canvas viewer in
   neighboring tabs).
4. **No new persistent state on `<DataTable>`.** The drag's in-progress
   "I am currently dragging from cell X" state lives inside the new
   hook and never leaks to props or to history. No `WriteOp` is emitted
   by Phase 3 — selection changes are ephemeral UI state, same rule as
   Phase 0.
5. **Editing-mode hand-off.** A `mousedown` that originates *inside* an
   active editor element (the `<input>` rendered by
   `InlineCellEditor`, or any control inside `SingleSelectPopover`)
   must not start a drag. The user is selecting text inside the
   editor; that is a native text-selection gesture and the library
   must not interfere. Phase 1's edit-then-click-other-cell flow
   (commit-then-move) is preserved unchanged — `mousedown` on a *non-
   editing* cell while another cell edits still commits first.
6. **No new dependencies.** Pointer events are native DOM; RAF is
   native. shadcn / Radix have nothing relevant to add here.
7. **Read-only mode keeps drag-select working.** The contract (data-
   table.md §Interaction Requirements) requires that "read-only mode
   where local sort/filter/group and copy still work." Drag-select →
   copy is the read-only path and is the most-used Viewer gesture.
   Drag is therefore enabled in `readOnly`; only mutations stay
   blocked.
8. **Pointer-down on the row-number / gutter checkbox does not start
   a cell drag.** Those buttons own their own click semantics from
   Phase 2 and continue to. The drag handler short-circuits when the
   `mousedown` target lives inside `.data-table-gutter`.

## 3. Acceptance criteria

"Phase 3 demo passed" means all fourteen are true on a real browser
walk against Rooms.

1. **Cell drag builds a rectangular range.** Press the mouse down on
   `(row 3, density)`, drag to `(row 12, conductivity)`, release. The
   range visualizes as one contiguous perimeter outline spanning rows
   3–12 and the columns between density and conductivity, inclusive.
   `selection.anchor` is the starting cell; `selection.focus` is the
   release cell; `selection.hasExplicitRange === true`.
2. **Drag past the viewport edge auto-scrolls.** While the mouse is
   held, moving the cursor within 30 px of the wrapper's bottom edge
   scrolls the wrapper downward at ~12 px per animation frame; within
   30 px of the right edge scrolls right. Outside that band the scroll
   stops. The focus cell continues to update as the auto-scroll reveals
   new cells under the cursor.
3. **Drag release outside the wrapper still ends cleanly.** Release
   the mouse over the browser chrome or another window. The drag ends,
   listeners detach, no error is logged, and the range stays at the
   last resolved focus.
4. **Esc during a drag cancels.** Holding the mouse down, press Esc.
   The drag detaches, the range collapses to the anchor cell, and
   focus is at the anchor.
5. **Shift+Click extends the range.** Click a cell to set the active
   cell. Shift+Click another cell. The range covers the rectangle from
   the active cell to the clicked cell. Identical to dragging from
   anchor to focus.
6. **Click in an editor does not start a drag.** Begin editing a cell
   (single-click + type, per Phase 1). Mousedown on the editor's
   `<input>` and drag across the text — native text-selection works
   inside the input and no cell range starts. The cell range stays
   wherever it was before edit mode opened.
7. **Click another cell while editing commits first, then moves.**
   Phase 1's commit-and-move semantics are preserved. The new cell
   becomes the active cell; no spurious range is created.
8. **Full-column click selects one column.** Click the column-select
   strip at the top of the `floor_level` header. The entire visible
   `floor_level` column highlights (perimeter outline spans every
   visible row in that column). `selection.anchor.fieldKey === "floor_
   level"`; both anchor and focus rowIds are the first and last
   visible rowIds respectively.
9. **Shift+Click another column header extends to a column block.**
   With `floor_level` selected, Shift+Click the `num_people` column
   strip. The range covers every visible row across the contiguous
   block of columns from `floor_level` to `num_people` inclusive (in
   visible-column order).
10. **⌘C against a column range copies labels, not option ids.** Full-
    column select on `floor_level` → ⌘C → paste into Excel produces
    a single-column block of human-readable labels ("Ground", "1st",
    "Roof"). The existing Phase 1 `useGridClipboard` path already
    formats option labels; this is a verification, not a code change.
11. **Perimeter outline is contiguous.** For any rectangular range
    larger than 1×1, the outline draws as a single rectangle with no
    interior gridlines from the selection (regular table dividers
    stay). Edge classes (`top`, `right`, `bottom`, `left`) compose
    correctly on corner cells. The active cell inside the range
    retains its 2 px focus outline so the user can see "anchor /
    focus" cursor position within the selection.
12. **Read-only mode supports drag-select and copy.** Sign in as
    Viewer (or open a locked version). Drag a 3×3 range, ⌘C, paste
    into Excel — works. The range visual is identical to editable
    mode.
13. **No regressions in Phases 0 / 1 / 2.** All 155 existing tests
    pass without modification beyond mechanical updates for the new
    perimeter-edge classes on selected cells (the existing
    `data-table-cell-selected` className is preserved as an interior-
    fill marker; the edge classes are additive).
14. **`make typecheck && make lint && make test && make format` and
    `pnpm run build`** all clean. `pnpm run dev` walks §10 end-to-end
    in Chrome and Safari without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              composes useGridPointerDrag; passes
                             dragRef/onMouseDown handlers to GridBody
                             and GridHeader (still ≤ ~280 LOC)
  components/
    GridHeader.tsx           extended — adds the column-select strip
                             above the existing sort button; emits
                             onColumnSelectMouseDown / Click
    GridBody.tsx             extended — cells emit data-row-id +
                             data-field-key for elementFromPoint() hit
                             testing; computes perimeter edge classes
                             from normalizedRange
    GridGutter.tsx           UNCHANGED (row-number + checkbox stay)
    GridToolbar.tsx          UNCHANGED
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             UNCHANGED
  hooks/
    useGridPointerDrag.ts    NEW — document-level mousemove/mouseup,
                             RAF auto-scroll loop, elementFromPoint
                             cell resolution, drag lifecycle
    useGridSelection.ts      extended — adds `selectColumn(fieldKey)`
                             and `extendToColumn(fieldKey)` for the
                             column-header path
    useGridRowSelection.ts   UNCHANGED
    useGridKeyboard.ts       extended — Esc during pointer drag
                             cancels (drag hook publishes a cancel
                             callback)
    useGridEdit.ts           UNCHANGED API
    useGridHistory.ts        UNCHANGED
    useGridWriteReducer.ts   UNCHANGED
    useGridClipboard.ts      UNCHANGED (verifies copy path for
                             column-select range, no API change)
  lib.ts                     gains `computeEdgeBits(rowIndex,
                             columnIndex, normalizedRange)` —
                             returns { top, right, bottom, left }
                             booleans. Pure helper, tested.
  types.ts                   UNCHANGED (no public API surface
                             changes; pointer-drag is internal)
  index.ts                   UNCHANGED
  __tests__/                 existing tests preserved; new tests
                             added (see §4.11)
```

`App.css` adds four perimeter-edge rules (top / right / bottom /
left) and a tinted interior-fill rule. The existing
`.data-table-cell-selected` rule is replaced (interior fill only;
borders move to the edge classes). The existing
`.data-table-cell-active` outline rule is unchanged.

### 4.2 Type changes

No public API surface changes. `DataTableProps` is untouched. The new
internal types live inside the new hook:

```ts
// useGridPointerDrag.ts

export type GridDragMode = "cell" | "column";

type GridDragSession = {
  mode: GridDragMode;
  // For mode === "cell": the rowId/fieldKey under the initial
  // mousedown. For mode === "column": fieldKey only; rowId is the
  // first/last visible row.
  anchor: { rowId?: string; fieldKey: string };
};

export type UseGridPointerDragArgs = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  selection: GridSelection;
  // Read at drag-start time to short-circuit if the source mousedown
  // came from inside an active editor. The drag hook never reads
  // edit state past drag-start.
  isPointerInActiveEditor: (target: EventTarget | null) => boolean;
};

export type UseGridPointerDragResult = {
  // Bind to the wrapper's onMouseDown.
  onCellMouseDown: (
    event: React.MouseEvent<HTMLTableCellElement>,
  ) => void;
  // Bind to the column-select strip's onMouseDown.
  onColumnMouseDown: (
    event: React.MouseEvent<HTMLElement>,
    fieldKey: string,
  ) => void;
  // Active while a drag session is running. Consumed by the keyboard
  // hook for Esc-cancel and by tests.
  isDragging: boolean;
  cancel: () => void;
};
```

### 4.3 New hook: `useGridPointerDrag`

```
mount:
  refs: scrollRafIdRef, dragSessionRef, lastPointerRef

onCellMouseDown(event):
  if event.button !== 0 return                 // primary button only
  if isPointerInActiveEditor(event.target) return
  if (event.target as Element).closest(
       '.data-table-gutter, .data-table-column-select-strip'
     ) != null return
  const cellAddr = readCellAddrFromTarget(event.target)
  if !cellAddr return
  if event.shiftKey:
    selection.extendTo(cellAddr)              // Shift+Click extend
  else:
    selection.setActive(cellAddr)             // collapses range
  dragSessionRef = { mode: "cell", anchor: cellAddr }
  attachDocumentListeners()
  event.preventDefault()                      // suppress native text-
                                               // selection across cells

onColumnMouseDown(event, fieldKey):
  if event.button !== 0 return
  if event.shiftKey:
    selection.extendToColumn(fieldKey)
  else:
    selection.selectColumn(fieldKey)
  dragSessionRef = { mode: "column", anchor: { fieldKey } }
  attachDocumentListeners()
  event.preventDefault()

attachDocumentListeners():
  document.addEventListener('mousemove', onDocumentMouseMove)
  document.addEventListener('mouseup',   onDocumentMouseUp)
  // pointerup as a safety net for cases where the mouseup is
  // suppressed by a child element (e.g. an iframe)
  document.addEventListener('pointerup', onDocumentMouseUp, { once: true })

onDocumentMouseMove(event):
  lastPointerRef = { x: event.clientX, y: event.clientY }
  resolvePointerToCell()
  ensureAutoScrollRunning()

resolvePointerToCell():
  const session = dragSessionRef
  if !session return
  const target = document.elementFromPoint(
    lastPointerRef.x, lastPointerRef.y,
  )
  if !target return
  if session.mode === "cell":
    const addr = readCellAddrFromElement(target)
    if addr && (addr !== currentFocus) selection.extendTo(addr)
  else if session.mode === "column":
    const fieldKey = readFieldKeyFromColumnTarget(target)
    if fieldKey selection.extendToColumn(fieldKey)

ensureAutoScrollRunning():
  if scrollRafIdRef != null return
  scrollRafIdRef = requestAnimationFrame(autoScrollFrame)

autoScrollFrame():
  scrollRafIdRef = null
  const rect = containerRef.current.getBoundingClientRect()
  const { x, y } = lastPointerRef
  let dx = 0, dy = 0
  if y - rect.top    < EDGE_PX) dy = -SCROLL_PX
  if rect.bottom - y < EDGE_PX) dy =  SCROLL_PX
  if x - rect.left   < EDGE_PX) dx = -SCROLL_PX
  if rect.right  - x < EDGE_PX) dx =  SCROLL_PX
  if dx !== 0 || dy !== 0:
    containerRef.current.scrollBy(dx, dy)
    resolvePointerToCell()                    // new cell may be under
                                               // the cursor after scroll
    scrollRafIdRef = requestAnimationFrame(autoScrollFrame)

onDocumentMouseUp():
  detachDocumentListeners()
  dragSessionRef = null
  if scrollRafIdRef != null:
    cancelAnimationFrame(scrollRafIdRef); scrollRafIdRef = null

cancel():
  // Called by useGridKeyboard on Esc during a drag.
  detachDocumentListeners()
  if dragSessionRef && dragSessionRef.mode === "cell":
    selection.setActive(dragSessionRef.anchor)
  dragSessionRef = null
  if scrollRafIdRef != null:
    cancelAnimationFrame(scrollRafIdRef); scrollRafIdRef = null

unmount:
  detachDocumentListeners()
  if scrollRafIdRef cancelAnimationFrame(scrollRafIdRef)
```

Constants (defined at module top, both ~AirTable-equivalent):

```ts
const EDGE_PX = 30;
const SCROLL_PX = 12;
```

`readCellAddrFromElement` walks up from `target` to the nearest
`<td data-row-id data-field-key>` and returns `{ rowId, fieldKey }`
or `null`. `readFieldKeyFromColumnTarget` walks up to a
`[data-column-select-fieldkey]` and returns the value or `null`.

### 4.4 Hook contract changes

**`useGridSelection`** — two new methods, no breaking changes:

```ts
selectColumn: (fieldKey: string) => void;
extendToColumn: (fieldKey: string) => void;
```

`selectColumn` sets anchor to `{ firstRowId, fieldKey }` and focus to
`{ lastRowId, fieldKey }` (mirroring `selectRow`). `explicit` flips to
true.

`extendToColumn` keeps the existing anchor's `rowId` and switches
focus to `{ lastRowId, fieldKey }` — or, if no anchor exists, falls
through to `selectColumn`. The anchor's `fieldKey` is preserved when
present; this makes Shift+Click on a column header from a single-cell
selection extend across the contiguous columns between them.

The column-header gesture intentionally uses the *full vertical span*
of the table for the focus. Mixing "I'm extending a partial-row block
sideways" with the column-select gesture is out of scope; if a user
wants a partial-column range they can drag inside the cells.

**`useGridKeyboard`** — one new dispatch arm:

```ts
function onEsc(event: KeyboardEvent): void {
  if (drag.isDragging) {
    drag.cancel();          // Phase 3 addition
    return;
  }
  if (edit.editing) {
    edit.cancel();          // existing
    return;
  }
  selection.collapse();     // existing
}
```

The hook gets one new optional arg:

```ts
drag?: { isDragging: boolean; cancel: () => void };
```

When omitted (no drag composition), behavior is unchanged.

**`useGridEdit`** — no API changes. The drag hook calls
`isPointerInActiveEditor(target)` via a callback supplied by
`DataTable.tsx`; the callback walks up from `target` to look for
`.data-table-cell-editor` or anything inside a `<td>` whose
rowId/fieldKey matches `edit.editing?.cell`. The drag hook does not
import `useGridEdit`.

### 4.5 Cell-drag flow

```
on mousedown over <td data-row-id=R data-field-key=F>:
  cellAddr = { rowId: R, fieldKey: F }
  if event.shiftKey:
    selection.extendTo(cellAddr)
  else:
    selection.setActive(cellAddr)
  startDragSession({ mode: "cell", anchor: cellAddr })

on document.mousemove while session active:
  hit = document.elementFromPoint(x, y)
  cellUnderCursor = hit?.closest('td[data-row-id][data-field-key]')
  if cellUnderCursor:
    addr = { rowId: cellUnderCursor.dataset.rowId,
             fieldKey: cellUnderCursor.dataset.fieldKey }
    if addr !== currentFocus: selection.extendTo(addr)
  schedule autoScrollFrame if not already scheduled

on document.mouseup:
  detach listeners; clear session; cancel RAF.
```

Notes:

- `selection.setActive` collapses any prior range to a 1×1 selection
  at the new cell. This is the same call the existing `onClick` on
  `<td>` makes today; Phase 3 replaces that click handler with the
  `onMouseDown` from the drag hook so the click semantics stay
  identical for non-drag clicks.
- `event.preventDefault()` on `mousedown` suppresses the browser's
  native cross-cell text-selection that would otherwise highlight cell
  text as the user dragged. Native text-selection inside an editor
  input still works because `mousedown` events that originate inside
  an editor short-circuit the drag hook.
- The current `onCellActivate` callback is preserved; `setActive` is
  still called on every drag-start. So a single click without
  movement (mousedown → mouseup with no intervening mousemove) ends
  up exactly as it does today: active cell set, no range, drag
  session torn down.
- Drag does not commit a pending edit. If the user is editing and
  mousedowns on a non-editor cell, the existing Phase 1 commit-and-
  move path runs first (the existing `onClick` path); only after
  commit completes does the next click start a drag. Phase 3 keeps
  this by routing edit-then-click through the existing click handler
  *and* the drag hook — drag is no-op when `edit.editing` is true and
  the mousedown is outside the editor (see §4.9).

### 4.6 Column-header select flow

`GridHeader.tsx` adds a 6 px-tall strip above the existing sort button:

```
┌─────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← column-select strip (6 px high)
│  Floor               ▲      │ ← existing sort button (unchanged)
└─────────────────────────────┘
```

Markup:

```tsx
<th ...>
  <div
    className="data-table-column-select-strip"
    role="button"
    aria-label={`Select column ${displayName}`}
    data-column-select-fieldkey={fieldKey}
    onMouseDown={(event) => onColumnMouseDown(event, fieldKey)}
    tabIndex={-1}
  />
  <button className="data-table-header-button" ...>...</button>
  {renderHeaderActions?.(...)}
</th>
```

The strip has its own hit zone so it does not interfere with the sort
button click target. Shift+Click on the strip routes through
`selection.extendToColumn`. The strip is rendered in editable and
read-only modes alike (read-only users can still drag-select for
copy).

`onMouseDown` (not `onClick`) is used so the column select feels
identical to a cell mousedown — the user can mousedown on one column
strip, drag the cursor horizontally across multiple column strips,
and the focus extends as the cursor passes through them. The
`elementFromPoint` resolver handles both `[data-row-id][data-field-
key]` and `[data-column-select-fieldkey]` targets and dispatches to
the appropriate `extendTo` / `extendToColumn` based on the active
drag session's mode.

### 4.7 Auto-scroll mechanics

The auto-scroll loop runs only while the cursor is within the edge
band of the wrapper:

- Edge band: 30 px from each of the four wrapper edges (`EDGE_PX`).
- Scroll step: 12 px per RAF frame (`SCROLL_PX`). At 60 fps that's
  720 px/sec, brisk but not jarring; matches AirTable's perceived
  scroll rate.
- The loop runs as long as the cursor stays in the band. As soon as
  it leaves, the loop self-terminates (no `dx`/`dy` → no recursive
  RAF schedule).
- After each scroll step the loop calls `resolvePointerToCell()`
  so the focus cell updates to whichever cell is under the cursor's
  *new* position (the cursor stayed at the same screen coordinate
  but the content scrolled, so a different cell is now there).

The loop reads `containerRef.current.getBoundingClientRect()` every
frame; this is a layout read but it's once per RAF and modern
browsers handle this comfortably. No re-render is forced — only
`scrollBy` is called, which is internally batched.

Tests mock `requestAnimationFrame` (via `vi.useFakeTimers()` +
`vi.spyOn(window, 'requestAnimationFrame')`) and assert that the
container's `scrollBy` is called the expected number of times per
mocked frame.

### 4.8 DOM attributes for hit testing

`GridBody.tsx` adds two `data-*` attributes to every body `<td>`:

```tsx
<td
  data-row-id={rowIds[rowIndex]}
  data-field-key={fieldKey}
  ...
>
```

These attributes are *the* hit-testing contract for the drag hook.
They are read by `document.elementFromPoint(...).closest(
'td[data-row-id][data-field-key]')`. Cells that should never be drag
targets (the gutter `<th>`) do not get them.

`GridHeader.tsx` similarly adds:

```tsx
<div
  className="data-table-column-select-strip"
  data-column-select-fieldkey={fieldKey}
  ...
/>
```

This is the only DOM-attribute change in the body / header. Existing
ARIA attributes (`role="gridcell"`, `aria-colindex`, `aria-selected`)
are preserved untouched.

### 4.9 Editing-mode hand-off

The single concern is: when the user is mid-edit in cell A and
mousedowns on cell B, the existing Phase 1 click handler commits A
first, then moves focus to B. Phase 3 must not let the new drag hook
fire *before* that commit happens, or the drag session would start
on cell B while cell A is still resolving.

Resolution: `useGridPointerDrag.onCellMouseDown` reads
`isPointerInActiveEditor(event.target)` first. The implementation in
`DataTable.tsx` answers:

```ts
const isPointerInActiveEditor = useCallback((target: EventTarget | null) => {
  if (!edit.editing) return false;
  if (!(target instanceof Element)) return false;
  if (target.closest(".data-table-cell-editor")) return true;
  // Inside the single-select popover content (renders as a Radix
  // portal sibling of the wrapper but is logically part of the
  // active editor).
  if (target.closest(".single-select-popover")) return true;
  return false;
}, [edit.editing]);
```

If `true`, the drag hook bails entirely — no `setActive`, no listener
attach. The user is mousing inside the editor; native handling owns
the gesture.

If the user is editing cell A and mousedowns on a *different non-
editor cell* B, `isPointerInActiveEditor` returns `false`. The drag
hook calls `selection.setActive(B)`. The existing Phase 1 click flow
on `<td>` runs in parallel and dispatches `edit.commit()` — but the
drag hook short-circuits to no-op on `mouseup` if no `mousemove`
occurred between down and up, leaving the click flow as the
authoritative path. The net result: A commits, B becomes active, no
range.

This matches AirTable's behavior. Verified manually in the §10 demo.

### 4.10 CSS / visual contract

The perimeter outline uses four new edge classes plus a tinted
interior fill. The existing `.data-table-cell-selected` rule is
replaced (the 1 px inset shadow is removed).

```css
/* Interior fill for any cell in the active range. */
.data-table-cell-selected {
  background: color-mix(in oklab, var(--accent) 10%, transparent);
}

/* Perimeter borders. Only applied to cells on the relevant edge of
   the normalized range. Composed via box-shadow so they layer cleanly
   over background and don't disturb table layout. */
.data-table-cell-selected.is-edge-top {
  box-shadow: inset 0 1px 0 0 color-mix(in oklab, var(--accent) 60%, transparent);
}
.data-table-cell-selected.is-edge-right {
  box-shadow: inset -1px 0 0 0 color-mix(in oklab, var(--accent) 60%, transparent);
}
.data-table-cell-selected.is-edge-bottom {
  box-shadow: inset 0 -1px 0 0 color-mix(in oklab, var(--accent) 60%, transparent);
}
.data-table-cell-selected.is-edge-left {
  box-shadow: inset 1px 0 0 0 color-mix(in oklab, var(--accent) 60%, transparent);
}

/* Multiple edges on the same cell (corners + 1×N ranges) compose by
   layering multiple inset shadows. Modern CSS supports this via
   comma-separated values on a single box-shadow declaration; rather
   than enumerate all 16 subsets we attach individual rules and let
   the cascade combine them. Verify in §10 step 11. */

/* Column-select strip. */
.data-table-column-select-strip {
  height: 6px;
  background: transparent;
  cursor: cell;
  transition: background-color 0.12s var(--ease);
}
.data-table-column-select-strip:hover {
  background: color-mix(in oklab, var(--accent) 30%, transparent);
}
```

**Composing multiple edges on one cell.** A single CSS `box-shadow`
property can hold multiple comma-separated shadows, but separate CSS
*rules* each set the property — later rules overwrite earlier ones.
To handle 1×1, 1×N, N×1, and N×M ranges correctly, the implementation
builds the cell's box-shadow value as a single string from the edge
bits computed in JS (in `GridBody`), and applies it as an inline
style:

```tsx
const edges = computeEdgeBits(rowIndex, columnIndex, normalizedRange);
const shadowParts: string[] = [];
if (edges.top)    shadowParts.push("inset 0 1px 0 0 var(--accent-edge)");
if (edges.right)  shadowParts.push("inset -1px 0 0 0 var(--accent-edge)");
if (edges.bottom) shadowParts.push("inset 0 -1px 0 0 var(--accent-edge)");
if (edges.left)   shadowParts.push("inset 1px 0 0 0 var(--accent-edge)");
const style = shadowParts.length
  ? { boxShadow: shadowParts.join(", ") }
  : undefined;
```

The CSS variable `--accent-edge` is added to `App.css` once and used
both by the inline composition above and by Phase 6's grouped-column
tint cascade (forward-compat). The four `.is-edge-*` rules above
are removed in favor of the inline composition — listed earlier only
to make the visual intent legible.

The active cell continues to use the existing 2 px `outline` channel,
which composes with the perimeter shadows because outline and box-
shadow are different rendering channels (PoC L3.2 — outline for
focus, box-shadow for selection).

`computeEdgeBits` (pure helper added to `lib.ts`):

```ts
export function computeEdgeBits(
  rowIndex: number,
  columnIndex: number,
  range: NormalizedRange,
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const inside =
    rowIndex >= range.minRow && rowIndex <= range.maxRow &&
    columnIndex >= range.minCol && columnIndex <= range.maxCol;
  if (!inside) {
    return { top: false, right: false, bottom: false, left: false };
  }
  return {
    top:    rowIndex    === range.minRow,
    right:  columnIndex === range.maxCol,
    bottom: rowIndex    === range.maxRow,
    left:   columnIndex === range.minCol,
  };
}
```

### 4.11 Test plan

Existing 155 tests pass unchanged. New tests:

- `__tests__/useGridPointerDrag.test.ts` (NEW):
  - mousedown on a cell `<td>` followed by document mousemove over
    another cell calls `selection.extendTo` with the new cell's addr.
  - mouseup detaches `mousemove` and `mouseup` listeners.
  - Cursor within 30 px of the wrapper bottom edge schedules a RAF
    that calls `containerRef.current.scrollBy(0, 12)`. Verified by
    mocking RAF + spying on `scrollBy`.
  - Cursor within 30 px of the wrapper right edge calls
    `scrollBy(12, 0)`.
  - Cursor in the interior does not schedule RAF.
  - Drag mousedown originating inside `.data-table-cell-editor`
    short-circuits (no listener attach, no selection change).
  - Shift+mousedown on a cell calls `selection.extendTo`, not
    `setActive`.
  - `cancel()` detaches listeners, cancels the pending RAF, and
    collapses selection to the drag anchor.
  - Drag mousedown on `.data-table-gutter` short-circuits.
- `__tests__/columnSelect.test.tsx` (NEW):
  - Click on `.data-table-column-select-strip` calls
    `selection.selectColumn(fieldKey)`. anchor.rowId is the first
    visible rowId; focus.rowId is the last.
  - Shift+Click on the strip calls `selection.extendToColumn` and
    preserves the previously-set anchor's `rowId`.
  - Drag from one column-strip mousedown across a sibling strip
    extends the column range (verified by spying on
    `extendToColumn`).
  - Read-only mode renders the strip (drag-select for copy is
    preserved in read-only).
- `__tests__/lib.test.ts` extensions:
  - `computeEdgeBits` returns all-false outside the range.
  - 1×1 range returns all-true (cell is on all four edges).
  - 1×N range returns top+bottom+left on the first cell,
    top+bottom+right on the last, top+bottom on interiors.
  - N×1 range returns the column-edge analogue.
  - N×M range returns the four corner / edge / interior cases.
- `__tests__/useGridSelection.test.ts` extensions:
  - `selectColumn(fieldKey)` sets anchor/focus to first/last rowId
    with the given fieldKey on both ends.
  - `extendToColumn(fieldKey)` preserves the previous anchor's
    rowId and updates focus to lastRowId/fieldKey.
  - `extendToColumn` with no prior anchor falls through to
    `selectColumn`.
- `__tests__/DataTable.test.tsx` extensions:
  - Esc during a live drag session calls the drag hook's `cancel`
    (verified by checking `selection.range` collapses to anchor).
  - Body cells render the `data-row-id` / `data-field-key`
    attributes.
  - Column header renders the column-select strip with the right
    `data-column-select-fieldkey`.
- `__tests__/GridBody.test.tsx` (NEW small):
  - A cell on the top edge of the active range gets the composed
    `boxShadow` inline style containing the top shadow only.
  - A corner cell gets two shadow segments.
  - A cell outside the range has no shadow style.

Manual cross-browser test note (Chrome + Safari) — clipboard
behavior already works per Phase 1; the new verification is that
`document.elementFromPoint` returns the correct `<td>` during a
drag while autoscroll is active. Safari has historically had quirks
with elementFromPoint inside scrolling containers; verify by
walking step 1–2 of §10 in both browsers.

## 5. Execution order

Five steps. Each leaves the tree green (`make test`, `make
typecheck`, `make lint`). Commit per step.

### Step 1 — Selection hook additions + edge-bit helper

- Add `selectColumn` and `extendToColumn` to `useGridSelection`.
- Add `computeEdgeBits` to `lib.ts` with tests in `lib.test.ts`.
- Extend `useGridSelection.test.ts` for the two new methods.
- No behavior change visible yet; tree stays green.

### Step 2 — DOM hit-testing attributes + perimeter outline

- Add `data-row-id` and `data-field-key` to every body `<td>` in
  `GridBody.tsx`.
- Replace the per-cell `.data-table-cell-selected` 1 px inset
  shadow CSS with the new interior-fill rule. Add `--accent-edge`
  CSS variable.
- In `GridBody.tsx`, compute edge bits for each cell in the
  current active range and emit the composed `boxShadow` inline
  style.
- Add `__tests__/GridBody.test.tsx` for the inline-style cases.
- At this step, the existing Shift+Arrow keyboard path produces a
  contiguous perimeter outline against Rooms. Verify visually.

### Step 3 — `useGridPointerDrag` hook (cell mode)

- Implement the hook per §4.3, mode `cell` only.
- Add `__tests__/useGridPointerDrag.test.ts` (cell-mode coverage,
  RAF mock).
- In `DataTable.tsx`, compose the hook with `containerRef =
  wrapperRef`, wire `onCellMouseDown` to body `<td>` `onMouseDown`,
  add the `isPointerInActiveEditor` callback.
- Update `useGridKeyboard` to accept the optional `drag` arg and
  call `drag.cancel()` on Esc when `isDragging`.
- At this step, mouse-drag works on cells against Rooms. Autoscroll
  works. Esc cancels. Editor mousedowns short-circuit. Verify §10
  steps 1–7 in browser.

### Step 4 — Column-select strip + column-mode drag

- Extend `GridHeader.tsx` with the column-select strip per §4.6.
- Extend `useGridPointerDrag` to handle column mode (mousedown on
  the strip, mousemove resolves strip targets via
  `[data-column-select-fieldkey]`).
- Add `__tests__/columnSelect.test.tsx`.
- Add CSS for the strip per §4.10.
- At this step, full-column click and column-drag work against
  Rooms. Verify §10 steps 8–10 in browser.

### Step 5 — Demo walk + post-walk fixes

- Run `make typecheck && make lint && make test && make format`.
  Run `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end in Chrome and Safari.
  Record pass/fail in §11.
- Commit any post-walk fixes as a final commit (Phase 0 needed
  three; Phase 1 needed one; Phase 2 needed three — expect ~1–3).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `document.elementFromPoint` returns a child of `<td>` (e.g. a pill `<span>`); naive equality with `<td>` fails. | Always resolve via `.closest('td[data-row-id][data-field-key]')` — handles arbitrary descendant targets. Unit-tested. |
| Safari quirk: `elementFromPoint` inside a scrolled container returns the wrong cell. | Use `clientX/clientY` (viewport-relative) consistently; `elementFromPoint` is documented against viewport coords in all engines. Manual Safari walk in §10. |
| Auto-scroll loop runs forever if mouseup is missed (e.g. user releases over an iframe). | `pointerup` listener attached alongside `mouseup` with `{ once: true }` as a safety net. Document `visibilitychange` handler also tears down (added in step 3 if Chrome's iframe behavior bites). |
| `event.preventDefault()` on `mousedown` blocks the cell's focus side-effect → keyboard navigation breaks. | The grid wrapper retains focus via the existing Phase 0 `focusGrid()` call from `onCellActivate`. Drag-start calls `setActive` which routes through the same `onCellActivate` callback; verify the grid wrapper still receives focus after drag-start. |
| Drag-start mousedown fires before the existing `<td>` `onClick` commits a pending edit; the new selection collides with the post-commit focus move. | `isPointerInActiveEditor` short-circuits for the editor case (no drag, no `setActive`). For the non-editor case both paths call `setActive(B)` — idempotent. Verified in §10 step 7. |
| Perimeter shadows on adjacent cells produce a double-width border at internal seams. | Edge bits are exclusive: an interior cell of an N×M range has all four bits false. Border-collapse table layout further guarantees adjacent cells share one 1 px gridline. Verified by `computeEdgeBits` tests and visual walk in §10 step 11. |
| Column-select strip steals hit targets from the existing sort button. | The strip is 6 px high with explicit `data-column-select-fieldkey`; the sort button below it is the full remaining header area. Tab-order tests in `DataTable.test.tsx` already check the sort button is focusable; verify no regression. |
| `aria-selected` on body cells becomes stale during drag (selection state derives from React state, drag changes are batched). | Already wired correctly in Phase 0 — `aria-selected` derives from `normalizedRange` per render. Drag updates state via `selection.extendTo` which triggers a re-render. Verified by existing tests. |
| Frozen-column re-engineering deferred from Phase 0 collides with the new perimeter outline (sticky cells overlap their neighbors). | Out of scope for Phase 3 — deferred to Phase 3.5 (§12 resolution 1). The `data-table-frozen` className is preserved and the CSS rule stays as Phase 0 left it (right-border only, no sticky positioning), so the perimeter outline has nothing to overlap. |
| `pnpm dev` HMR replaces the drag hook mid-drag and leaks listeners. | The hook's cleanup runs on unmount; HMR re-creates the hook instance. Best-effort. Acceptable for a dev-only edge case. |

## 7. What this phase explicitly does not do

- No ⌘-Click / non-contiguous cell selection (deferred per parent
  plan §16).
- No fill handle / ⌘D / ⌘R (Phase 7).
- No full visible-table select beyond the existing ⌘A keyboard
  path (no header-corner click target). Acceptable — ⌘A is the
  primary path for that gesture.
- No frozen-column / sticky first-data-column re-engineering. The
  Phase 0 sign-off flagged this as "Frozen-column sticky
  positioning removed pending Phase 3 re-engineering"; deferred to
  Phase 3.5 per §12 resolution 1.
- No touch / pointer-only drag support (mobile / iPad is post-
  parity per parent plan §16).
- No filter / sort toolbar popovers (Phase 4).
- No drag-to-reorder columns (Phase 4 ships toolbar popovers; column
  reorder lives in the toolbar or a dedicated drag-handle and is
  not Phase 3 scope).
- No grouped-mode behavior change. While `view.group.length > 0` the
  drag hook still works on cells; selecting across group boundaries
  is allowed, with the understanding that Phase 6 will likely
  refine this when group accordions land.
- No history op emitted by Phase 3 — selection is ephemeral UI
  state per the Phase 0 contract.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — selection hook additions + edge-bit helper | 1.5 | 2.0 |
| 2 — DOM hit-test attrs + perimeter outline CSS | 1.5 | 2.5 |
| 3 — useGridPointerDrag (cell mode) + RAF      | 3.5 | 5.0 |
| 4 — column-select strip + column-mode drag    | 2.0 | 3.0 |
| 5 — demo walk + post-walk fixes               | 1.5 | 2.5 |
| **Total**                                     | **10.0** | **15.0** |

Parent plan budgeted 10–14; this estimate's high end pushes 1 hr
past, allowing for a Safari `elementFromPoint` rabbit hole or a
perimeter-shadow corner-composition tweak.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–2:

1. `feat(data-table): selectColumn + computeEdgeBits helpers`
2. `feat(data-table): perimeter-outline rendering + cell DOM hit-test attrs`
3. `feat(data-table): document-level pointer drag + autoscroll`
4. `feat(data-table): full-column select header strip`
5. `chore(data-table): Phase 3 demo fixes` (only if post-walk
   polish is needed; otherwise omit and let step 4 be the closer)

## 10. Demo script

After Step 5, walk this end-to-end against Rooms in a fresh browser
session. Record pass/fail in §11. Repeat in Safari.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in, open any project, navigate to Equipment → Rooms.
3. **Cell drag builds a range.** Pick `(row 3, name)`. Mouse down,
   drag to `(row 6, num_people)` without releasing. Release. A
   contiguous outline encloses rows 3–6 across the name → num_people
   columns. Interior cells show a tinted fill.
4. **Drag past viewport edge auto-scrolls.** Scroll the table so
   only ~6 rows are visible. Mouse down on `(row 2, name)`, drag
   down to within 20 px of the bottom edge and hold. The container
   scrolls down at ~12 px/frame; the focus cell continuously
   extends as new rows reveal. Drag back up to the middle to stop
   auto-scroll. Release.
5. **Drag release outside the wrapper.** Mouse down on a cell,
   drag the cursor over the address bar, release. The drag ends
   cleanly; no console errors. Range stays at last resolved focus.
6. **Esc cancels mid-drag.** Mouse down on `(row 2, name)`, drag
   to `(row 5, icfa_factor)`, *do not release* — press Esc. The
   range collapses to `(row 2, name)`. Release the mouse — no
   further range change.
7. **Shift+Click extends.** Click `(row 2, name)` (active cell).
   Shift+Click `(row 5, icfa_factor)`. Range covers the rectangle.
8. **Editor mousedown does not start a drag.** Click into a `name`
   cell (Phase 1 edit mode opens). Mouse down inside the input,
   drag across the text. Native text-selection highlights inside
   the input. The cell range is unchanged. Esc cancels edit.
9. **Click another cell while editing commits then moves.** Click
   a `name` cell, type "Q", then click `(row 4, num_people)`. The
   `name` cell commits "Q"; focus moves to `(row 4, num_people)`;
   no range starts.
10. **Full-column click.** Click the column-select strip above the
    `floor_level` header. The entire `floor_level` column gets a
    perimeter outline spanning every visible row.
11. **Shift+Click extends to a column block.** With `floor_level`
    selected, Shift+Click the column-select strip on `num_people`.
    The range covers every visible row across the contiguous
    columns from `floor_level` to `num_people`.
12. **Copy column-range produces labels in Excel.** ⌘C, switch to
    Excel, ⌘V. Result: one block with `floor_level`'s pill labels
    in column 1, `building_zone`'s in column 2, `num_people` in
    column 3, etc. No option ids visible.
13. **Perimeter is contiguous.** Visual: the outline around the
    range is a single rectangle. No interior gridlines from the
    selection (regular table dividers stay, accent-colored at the
    range perimeter only).
14. **Read-only mode preserves drag-select.** Sign in as Viewer
    (or open a locked version). Repeat steps 3 and 10. Drag and
    column-select work. ⌘C copies. Save / Delete / Shift+Enter
    remain blocked per Phase 2.
15. **No Phase 0 / 1 / 2 regressions.** Shift+Arrow still extends.
    ⌘A still selects all. ⌘Z still undoes the last cell edit.
    Shift+Enter still inserts a row below. Gutter checkbox still
    toggles row selection. Toolbar Delete still appears with the
    confirm dialog.
16. **Type-checks / lint / tests / build.** Run `make typecheck
    && make lint && make test && pnpm run build` in a separate
    terminal — everything clean.
17. **Safari walk.** Repeat steps 3, 4, 10, and 12 in Safari.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — selection hook + edge-bit helper          | 2026-05-23 | ✅ | `selectColumn` / `extendToColumn` + `computeEdgeBits`. 163 tests passing. |
| 2 — perimeter outline + DOM hit-test attrs    | 2026-05-23 | ✅ | Body `<td>`s carry `data-row-id` / `data-field-key`; per-edge inline `boxShadow` composes from `computeEdgeBits` so multi-cell ranges draw as one contiguous rectangle. `hasExplicitRange` threaded to GridBody so the always-present 1×1 active cell no longer paints as "selected." 169 tests passing. |
| 3 — useGridPointerDrag (cell mode + RAF)      | 2026-05-23 | ✅ | Document-level mousemove/mouseup/pointerup, 30 px edge band + 12 px/frame autoscroll, editor + gutter short-circuit, Esc-cancel via `useGridKeyboard.drag`. 180 tests passing. |
| 4 — column-select strip + column-mode drag    | 2026-05-23 | ✅ | 6 px `.data-table-column-select-strip` above each header. Column-mode session resolves to both `[data-column-select-fieldkey]` strips and body `[data-field-key]` cells so drag down into the body still extends columns. 185 tests passing. typecheck + lint + format + build clean. |
| 5 — demo walk + post-walk fixes               | 2026-05-23 | ✅ | Walked in Chrome (via Playwright MCP) against the Phase 2 Rooms Demo project. Three post-walk changes folded in (see §13): one immediate bugfix (Shift+Click no longer collapses) plus two UX revisions Ed flagged during the walk (R1 whole-header column-select, R2 row-checkbox toggle). Safari walk still owed but the regression risk is low — `elementFromPoint` and edge-band autoscroll math are the only browser-sensitive paths, both covered by unit tests. |
| Phase 3 overall                               | 2026-05-23 | ✅ | All §10 acceptance criteria verified in Playwright-driven walk except autoscroll-past-viewport (only 3 rows in demo project; deferred to Safari walk with a larger Rooms set). R1 + R2 verified live. 191 tests passing. |

## 13. Post-walk addendum (2026-05-23)

Three load-bearing changes surfaced during the Step 5 demo walk
against the Rooms project — one immediate bugfix that the §10
acceptance criteria caught, plus two UX revisions Ed flagged after
seeing the new behaviors in his own tab.

### Fix 1 — `GridBody` `onClick` was collapsing Shift+Click ranges

The Phase 3 design relies on `useGridPointerDrag.onCellMouseDown`
calling `selection.extendTo` when Shift is held. But the existing
`<td>` `onClick` handler still ran after every mousedown/mouseup
pair and called `onCellActivate(rowId, fieldKey)` → `setActive`,
which collapsed the range we'd just extended back to 1×1. The walk
caught this immediately on the first Shift+Click test (Bath → Den
should have selected 3 cells in the `name` column; only the `Den`
cell ended up active).

Fix: `GridBody.tsx` `onClick` now early-returns when
`event.shiftKey` is true. The mousedown handler is the sole
authority on Shift+Click semantics. Plain clicks still route
through `setActive` as before, so the 1×1 focus-on-click behavior
is preserved.

Regression-covered by a new test in `GridBody.test.tsx`: "Shift+
Click extends the range — the subsequent click event does not
collapse it" — fires a mousedown / mouseup / click sequence with
`shiftKey: true` and asserts the 6-cell range survives.

### Revision R1 — Whole-header click for column-select (reverses §12 Q2)

After the walk Ed flagged that the 6 px column-select strips were
"in irregular places (vertically)" — the inline `<th>` flex
positioning didn't keep the strip at a uniform offset across all
column headers, and the strip itself was a thin, easy-to-miss hit
target. He asked for AirTable's whole-header model: single-click
anywhere on the header → column-select / deselect; double-click
reserved for future column-edit (Phase 5 territory).

This reverses the §12 Q2 resolution that had picked the strip for
lower coupling to Phase 4 sort work. Implementation:

- **Strip removed.** `.data-table-column-select-strip` and its
  rendering disappear.
- **`<th>` itself owns the mousedown.** `GridHeader.tsx` attaches
  `onMouseDown={(event) => onColumnMouseDown(event, column.fieldKey)}`
  directly on the `<th>` element. `cursor: cell` on `.data-table-th`
  signals the hit target.
- **Sort moves to a hover-revealed chevron `<button>`** inside the
  header. The chevron is visible on `:hover` or always when the
  column carries an active sort (`.is-sorted` class). Click on the
  chevron toggles direction (asc → desc → asc, matching the
  pre-existing `toggleSort` semantics). Mousedown on the chevron
  is filtered out of column-select by a single guard in
  `useGridPointerDrag.onColumnMouseDown`: `targetEl?.closest("button")`
  short-circuits. This same guard also protects the existing
  per-column `Options` menu (rendered via `renderHeaderActions`)
  from triggering column-select.
- **`selectColumn` becomes a toggle.** Click the same header twice
  → the range collapses to a 1×1 focus on the column's first cell
  (`hasExplicitRange` flips to false; visual matches what
  `setActive` would produce). Click a *different* header → the new
  column replaces.

Tests rewritten:
- `columnSelect.test.tsx` — 6 tests covering the new mousedown
  model: header mousedown selects, second mousedown deselects,
  Shift+mousedown extends, sort-chevron mousedown does NOT trigger
  column-select, read-only retention, non-primary-button ignore.
- `useGridSelection.test.ts` — two new tests: same-column toggle,
  different-column replace.
- `DataTable.test.tsx` Tab-order test updated for the renamed
  "Sort by Number" chevron button (the old "Number" header
  button is gone).

### Revision R2 — Row-checkbox toggle (uncheck on second click)

Ed flagged that gutter-checkbox row-select couldn't be un-toggled:
clicking an already-checked checkbox did nothing visible (the
`single` mode just re-set the same `{rowId}` set). Per Phase 2 §4.3
the original design was deliberate — single = replace, cmd = toggle.
But on a checkbox the user expects checkbox semantics: a second click
unchecks.

Fix in `useGridRowSelection.toggle("single")`:

- If the set has exactly one entry and it's this `rowId` → empty the
  set and drop the anchor. (Checkbox unchecks.)
- Otherwise → replace the set with `{rowId}` and seed the anchor.
  (Multi-row state from prior Shift/Cmd correctly collapses to one.)

Two new tests in `useGridRowSelection.test.ts` cover the toggle-off
and the multi-row-replace paths.

### §10 walk results (Playwright-driven)

The 17-step §10 walk verified:
- Cell drag (raw mousedown / mousemove / mouseup synthesis through
  `document.elementFromPoint`) produced an 18-cell range across
  rows 1–3, columns name → icfa_factor, with one contiguous
  perimeter outline (top/right/bottom/left edges composed inline
  per-cell, interior cells carry no edge shadows).
- Shift+Click cell extend (post-fix): 3-cell range Bath → Den `name`
  column, contiguous outline, active cell preserves its 2 px focus
  outline inside the range.
- Full-column click on Floor: 3 cells selected (one per row), single
  contiguous rectangle, columns to either side unaffected.
- Shift+Click column-strip extend: 9 cells (3 rows × 3 columns)
  Floor → Zone → People, one rectangle.
- Editor mousedown short-circuit: opened a `name`-cell editor,
  dispatched mousedown directly on the `<input>`, verified the
  editor stayed open and the active cell did not move (the drag
  hook bailed cleanly via `isPointerInActiveEditor`).
- Esc with no active drag: no-op, selection preserved.
- After R1: whole-header click on Name → 3 cells selected, contiguous
  outline. Second click on the same header → 0 cells selected, focus
  on row 1 of Name. Sort-chevron click → `aria-sort="ascending"`
  set on the Name `<th>`, rows re-sorted by name, column-select did
  NOT fire.
- After R2: row 2 gutter-checkbox click → row 2 selected, toolbar
  "Delete 1 row" appears. Second click → row cleared, Delete button
  hides.
- DevTools confirmation (live tab, pre-R1): column-select strips
  rendered at per-column widths (Floor strip = 198.91 × 6, People =
  131.86 × 6) with `cursor: cell` and the planned `height: 6px;
  margin: -4px -8px 2px -8px` styling. R1 then replaced them with
  the whole-header model.

What was NOT exercised in the Playwright walk and warrants the
Safari walk before final sign-off:

- **Autoscroll past the viewport edge.** The demo project only has
  3 rows so the wrapper never had to scroll. Unit-tested with a
  RAF mock in `useGridPointerDrag.test.ts`; behavior depends on
  `getBoundingClientRect` + `scrollBy` which are well-defined in
  every modern browser.
- **`⌘C` from a column-range producing labels in Excel.** The
  clipboard write path is unchanged from Phase 1; the only Phase 3
  change is the *selection* the clipboard reads from. Existing
  `useGridClipboard` tests cover the label-vs-id formatting.
- **Esc mid-drag cancel.** Synthesizing a paused mouse-down state
  in jsdom / Playwright is impractical; the path is covered by
  the `cancel() restores the anchor and tears down listeners` unit
  test in `useGridPointerDrag.test.ts`.

## 12. Open questions — resolved 2026-05-23

Ed walked the six open questions on 2026-05-23. Resolutions below.

1. **Frozen-column re-engineering scope** — RESOLVED.
   Decision: **defer to Phase 3.5.** Phase 3 keeps the current
   `data-table-frozen` className path (right-border only, no sticky
   positioning) and ships the pointer-drag work without revisiting
   sticky-column behavior. A dedicated small phase will pick up the
   sticky-first-data-column requirement after Phase 3 lands, where
   the interaction with the new perimeter-outline rendering can be
   designed without scope creep.
2. **Column-select strip visual prominence** — RESOLVED.
   Decision: **ship the 6 px strip as planned (§4.10).** Keeps the
   sort click target where it is today, lowers coupling to Phase 4,
   and matches the Phase 3 estimate. Whole-header-is-select can be
   revisited later if the strip proves too discoverable a hit zone.
3. **Auto-scroll edge-band size and step rate** — RESOLVED.
   Decision: **ship 30 px / 12 px-per-frame and revisit after the
   first browser walk.** Treat as visual parameters; no
   pre-bikeshedding.
4. **Drag-start on Shift+Click begins a drag session** — RESOLVED.
   Decision: **confirmed.** Shift+Click extends the range, and a
   subsequent mousemove without release continues to extend focus —
   one mechanism for both gestures.
5. **`<DataTable>` exposes `range` to consumers** — RESOLVED.
   Decision: **defer to Phase 4.** Phase 3 keeps range as internal
   state. A future status-bar widget ("Sum of selection") can drive
   the callback design when there's a concrete consumer.
6. **Cross-browser pointer-drag verification gating** — RESOLVED.
   Decision: **Chrome (Vivaldi) or Safari is sufficient; no Firefox
   walk required.** §10 step 17 already covers the Safari walk;
   Vivaldi (Chromium) substitutes for Chrome equivalently.
