---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Eighth in the 9-plan AirTable-parity polish series.
        Sequenced 8/9 (depends on plan 07's `columnOrder` ViewState
        field).
SCOPE: Add click-and-drag to reorder columns by dragging their
       headers. Reuses plan 07's `ViewState.columnOrder` field;
       provides a parallel keyboard-driven reorder path for
       accessibility. Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-COLREORDER-1)
PRECEDING-PLAN: docs/plans/2026-05-24/plan-07-tbl-hide-show-fields.md
                (establishes `ViewState.columnOrder` + the
                `onColumnOrderChange` callback this plan writes to)
RELATED:
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
    (where the drag affordance lives)
  - frontend/src/shared/ui/data-table/hooks/useGridPointerDrag.ts
    (Phase 3 pointer-drag hook — already has a `mode: "column"`
    lane for column-range selection; this plan adds a third lane
    for column reorder OR uses @dnd-kit/sortable to stay
    consistent with plan 07)
---

# Plan 08 — Drag-to-reorder columns

## 1. Why this plan exists

Plan 07 introduces column reorder via the Hide-fields panel (drag a
row in the list → column moves in the table). For users who prefer
direct manipulation — AirTable's primary reorder path — dragging the
column header itself should produce the same result.

Ed's 2026-05-24 review specified both surfaces as parity
requirements (image #3 shows the AirTable header). This plan adds
the header-drag surface; both write to the same
`view.columnOrder` field plan 07 established.

The plan also adds a keyboard-driven reorder for accessibility (per
US-TBL-COLREORDER-1 criterion 7 — WCAG-compliant alternative).

## 2. Binding constraints

1. **Library-only.** Changes in `GridHeader.tsx`, possibly small
   additions to `useGridPointerDrag.ts` OR a new sortable
   integration. CSS additions. Zero consumer touches.
2. **Same source of truth as plan 07.** Both surfaces call
   `onColumnOrderChange(nextOrder)`. No second piece of state.
3. **First column not reorderable.** The primary/frozen column
   (US-Builder-Tables criterion 4) stays first. Drag attempts on
   it are no-ops; it's not a valid drop target on either side of
   itself.
4. **Drag library choice: `@dnd-kit/sortable`** — same library
   plan 07 uses for the panel. Consistency wins over hand-rolled.
   The existing `useGridPointerDrag` hook stays scoped to cell
   range selection / column-range selection / fill (Phase 7); not
   extended to a third "reorder" mode.
5. **Drop indicator.** During drag, a vertical line renders
   between target columns showing where the drop will land. Active
   column header gets a translucent overlay.
6. **One semantic op per reorder.** A drag commits one
   `onColumnOrderChange` call; ⌘Z reverts. (Reorder is view state,
   not data state — should ⌘Z revert it? Defer to §6 risks: most
   AirTable view-state changes are NOT undoable. Decision: view-
   state changes stay non-undoable, matching existing Filter /
   Sort / Group changes.)
7. **Keyboard reorder.** Focus a column header (Tab navigation),
   press Space to "pick up", arrow keys to move (←/→ by 1 column),
   Space to drop, Esc to cancel.
8. **Group-by columns reorder live.** If a column is in active
   grouping, drag still works; group header re-renders against
   the new order.
9. **Persistence.** Plan 09 saves order to backend; this plan
   keeps order in the in-memory ViewState.

## 3. Acceptance criteria

1. **Hover affordance.** Hovering a column header (other than
   primary) shows a grab cursor and a subtle highlight indicating
   "draggable."
2. **Mouse drag.** Mouse-down on column header A, drag horizontally
   → A becomes translucent, drop-indicator line shows between
   columns where the drop would land. Release → A moves there.
3. **Drop-indicator alignment.** Line renders precisely between
   columns (1 px wide, accent color), updating on every mousemove.
4. **Primary column not draggable.** Mouse-down on the first
   column → no drag starts; grab cursor not shown.
5. **Primary column not a drop target.** Drag header B near the
   first column's right edge → drop-indicator does NOT render
   between primary and the next column; dropping there is a no-op.
6. **Drag updates `columnOrder`.** After drop, `view.columnOrder`
   contains the new sequence.
7. **Header drag and panel drag agree.** Drag header A right → 3
   positions; open the Hide-fields panel → A appears in the new
   position in the panel list.
8. **Cell selection unaffected.** Mouse-down on a cell still
   starts the existing Phase 3 cell drag; mouse-down on a header
   starts a column drag. No conflict.
9. **Keyboard reorder.** Tab to header B (focus visible), press
   Space → header gets "picked up" visual (border + accent), press
   → twice → drop indicator shifts right by 2 columns → Space →
   drop committed. Esc during pickup cancels.
10. **Drag during active filter / sort / group.** All compose:
    drag a column that's in the sort → sort still applies to that
    column (just renders in a new position).
11. **Read-only mode.** Drag still works for authenticated users
    in locked-version (view is per-user; not project data). Viewer
    (anonymous) mode does NOT persist — but in-memory drag still
    works for the session.
12. **Accessibility.** Header has `role="columnheader"` and
    `aria-grabbed` state during keyboard drag. Announce region
    fires `"<Field> moved to position N"` on drop.
13. **No regressions** to Phase 3 column-range selection (mouse-
    down on header for column select still works — see §4.2 for
    how drag vs. select distinguish).

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  components/
    GridHeader.tsx           extended: wrap header cells in
                             `<SortableHeaderCell>` (uses
                             `useSortable` from @dnd-kit/sortable);
                             render drag overlay during drag.
    SortableHeaderCell.tsx   NEW (small) — wraps useSortable; sets
                             grab cursor, transforms on drag.
  hooks/
    useGridKeyboard.ts       extended: column-header focused +
                             Space → toggle pickup state. Pickup
                             state in `useGridColumnDragKeyboard`
                             (small new hook below).
    useGridColumnDragKeyboard.ts
                             NEW (small) — tracks which header is
                             "picked up" (in keyboard drag mode);
                             arrow keys move the pickup target;
                             Space commits; Esc cancels.
                             Returns `{ pickedUp, onPickup, onMove,
                             onCommit, onCancel }`.
  GridHeader.tsx + types     accept new props: `onColumnOrderChange`
                             (already from plan 07), plus internal
                             state from the keyboard drag hook.
```

### 4.2 Drag vs. column-select disambiguation

Phase 3 (Pointer Drag Selection) gives column-range selection: click
a header → that column is selected; shift-click another header →
range selected. Mouse-down on header starts the column-select.

Plan 08 adds: mouse-down + horizontal move > THRESHOLD_PX (8 px) →
starts a column reorder drag (cancels the in-progress column-select
gesture).

Implementation:
- `@dnd-kit/sortable` has an `activationConstraint` — set
  `{ distance: 8 }` so the drag activates only after the pointer
  moves 8 px. Below that distance, the click is interpreted as a
  column-select.
- The two paths are mutually exclusive: dnd-kit's drag activation
  fires the drag event; the column-select handler sees the same
  mousedown but the cell-select handler reads the dnd-kit drag
  state and bails if a drag is active.

Test: simulate a 5 px mousedown+up → column-select fires; simulate
a 20 px drag → reorder fires (no column-select).

### 4.3 Keyboard reorder

`useGridColumnDragKeyboard.ts` is a small state machine:

```ts
type PickupState = { columnIndex: number; originalIndex: number } | null;

export function useGridColumnDragKeyboard(args: {
  visibleColumns: DataTableColumnDef[];
  onColumnOrderChange: (next: string[]) => void;
  onAnnounce: (msg: string) => void;
}) {
  const [pickedUp, setPickedUp] = useState<PickupState>(null);
  return {
    pickedUp,
    onPickup: (columnIndex: number) => {
      if (columnIndex === 0) return; // primary not draggable
      setPickedUp({ columnIndex, originalIndex: columnIndex });
      args.onAnnounce(`Picked up ${args.visibleColumns[columnIndex]?.displayName}. Use arrow keys to move.`);
    },
    onMove: (dx: -1 | 1) => {
      if (!pickedUp) return;
      const next = Math.max(1, Math.min(args.visibleColumns.length - 1, pickedUp.columnIndex + dx));
      setPickedUp({ ...pickedUp, columnIndex: next });
    },
    onCommit: () => {
      if (!pickedUp) return;
      if (pickedUp.columnIndex === pickedUp.originalIndex) {
        args.onAnnounce("Canceled.");
        setPickedUp(null);
        return;
      }
      const order = args.visibleColumns.map((c) => c.fieldKey);
      const [moved] = order.splice(pickedUp.originalIndex, 1);
      if (moved) order.splice(pickedUp.columnIndex, 0, moved);
      args.onColumnOrderChange(order);
      args.onAnnounce(`Moved to position ${pickedUp.columnIndex + 1}.`);
      setPickedUp(null);
    },
    onCancel: () => {
      if (!pickedUp) return;
      args.onAnnounce("Canceled.");
      setPickedUp(null);
    },
  };
}
```

`useGridKeyboard.ts` routes Space / Arrow / Esc on focused header
cells to these methods.

### 4.4 CSS

```css
.data-table-header-cell {
  cursor: default;
}
.data-table-header-cell[data-draggable="true"]:hover {
  cursor: grab;
  background: var(--hover-background);
}
.data-table-header-cell[data-dragging="true"] {
  opacity: 0.5;
}
.data-table-drop-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  z-index: 3;
  pointer-events: none;
}
.data-table-header-cell[data-picked-up="true"] {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

### 4.5 Test plan

- **`SortableHeaderCell.test.tsx` (NEW):**
  - Renders header content.
  - Picks up grab cursor when not primary.
  - Primary header has no grab cursor.
- **`useGridColumnDragKeyboard.test.ts` (NEW):**
  - `onPickup(1)` sets state; `onPickup(0)` is a no-op.
  - `onMove(1)` increments columnIndex (clamped to visibleColumns
    length - 1).
  - `onCommit()` calls onColumnOrderChange with the reordered list.
  - `onCommit()` with no change just clears state + announces
    "Canceled."
  - `onCancel()` clears state + announces.
- **`GridHeader.test.tsx` (extension):**
  - Drag simulation (mousedown + 20 px move + mouseup) calls
    `onColumnOrderChange` with new order.
  - Short mouse press (5 px movement) does NOT trigger reorder;
    falls through to column-select.
  - Drop indicator renders during drag.
  - Keyboard Space + Arrow + Space commits a reorder.
- **`DataTable.test.tsx` (extension):**
  - End-to-end: drag header A right → `view.columnOrder` updated
    → header + body re-render in new order.
  - Hide-fields panel reflects the new order.

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Sortable header cells

- Create `SortableHeaderCell.tsx` per §4.1.
- Wrap header cells in `GridHeader.tsx`.
- Configure dnd-kit with `activationConstraint: { distance: 8 }`
  per §4.2.
- Render drop indicator during drag.
- Tests: `SortableHeaderCell.test.tsx`, `GridHeader.test.tsx`
  extensions.
- Commit: `feat(data-table): drag-to-reorder column headers`.

### Step 2 — Keyboard reorder

- Create `useGridColumnDragKeyboard.ts` per §4.3.
- Wire into `useGridKeyboard.ts` (Space / Arrow / Esc on focused
  header cells).
- Tests: `useGridColumnDragKeyboard.test.ts`,
  `useGridKeyboard.test.ts` extensions.
- Commit: `feat(data-table): keyboard reorder for column headers`.

### Step 3 — Demo + integration check

- `make typecheck && make lint && make test`.
- `make dev`, walk §10.
- Verify Hide-fields panel reflects header-drag changes.
- Capture any post-walk fixes.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| dnd-kit drag activation conflicts with Phase 3 column-range selection — both want to consume mouse-down on header cells. | `activationConstraint: { distance: 8 }` defers dnd-kit until pointer moves 8 px. Below that, column-select wins. Tested. |
| Drag while filter / sort / group is active may reorder a column the sort references — sort should keep working on the reordered column. | Sort references column by `fieldKey`, not position. Reorder is a render-only concern. No coupling. |
| ⌘Z after a reorder — should it revert the reorder? Filter / Sort / Group changes are NOT undoable in PH-Navigator today. | Decision: reorder is view state, NOT data state, and stays non-undoable (matches Filter / Sort / Group). User reverts via panel or drag-back. Documented in §7. |
| Keyboard reorder requires the column header to be focusable. Today, header cells may not have `tabIndex={0}` set. | Add `tabIndex={0}` to non-primary header cells. Make sure focus styling matches the design system (existing focus-visible rules apply). |
| Drop indicator positioning is tricky with column widths varying — the line must render between two specific columns even as the user drags. | dnd-kit provides `over.id` on drag — the column being hovered. Position the indicator at that column's left edge (or right, depending on drag direction). Use `getBoundingClientRect()` of the over-column's `<th>`. |
| Multi-cell selection during drag — a user could shift-click a cell while another cell is also selected; if they then drag a column header, both gestures could fire. | dnd-kit's pointer-based activation is exclusive; once the drag starts, other mouse handlers should not interfere. Verified in Phase 3's column-select coexistence. |
| Touch device users (iPad) — grab cursor doesn't translate to touch. dnd-kit handles touch natively but the activation distance may need tuning. | Default `{ distance: 8 }` works on touch (it's a pixel distance, not a time threshold). If touch testing reveals false-positives, add a `delay: 150ms` alternative for touch. Not in scope for V2 v1; PH-Navigator's target users are pointer-first. |
| Reorder during an active fill drag (Phase 7) — both hooks listen for pointer events. | dnd-kit grabs the pointer when it starts dragging a header; Phase 7's fill handle is anchored on cell bodies. The two surfaces don't overlap geometrically. If user starts a header drag, the fill handle never participates. |

## 7. What this plan explicitly does not do

- Does not make column reorder undoable via ⌘Z. (View-state
  changes are non-undoable in PH-Navigator today; consistent.)
- Does not allow reordering of grouped / sorted column rules
  themselves (those use a separate `Filter` / `Sort` popover with
  its own stacking primitive).
- Does not let the user freeze additional columns. (Only the
  primary column is frozen.)
- Does not allow column resize. (Out of scope; future story.)
- Does not provide a "reset column order" button. (User can drag
  back, or "Reset view" in the toolbar overflow already clears
  columnOrder per Phase 6.)
- Does not handle reorder across hidden columns (the reorder works
  on the visible-columns array; hidden columns' positions are
  inferred from their declaration order).
- Does not support multi-column drag (Shift+select multiple
  headers + drag). One column at a time.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — sortable header cells            | 2.0 | 3.0 |
| 2 — keyboard reorder                 | 1.5 | 2.5 |
| 3 — demo + integration               | 0.5 | 1.0 |
| **Total**                            | **4.0** | **6.5** |

About one workday.

## 9. Commit plan

1. `feat(data-table): drag-to-reorder column headers`
2. `feat(data-table): keyboard reorder for column headers`

(Step 3 has no commit unless post-walk fixes are needed.)

## 10. Demo script

1. `make dev`, open Rooms.
2. Hover a non-primary header → grab cursor appears.
3. Hover primary header → default cursor.
4. Drag `name` header to the right of `floor_level` (drag 100+
   px) → drop indicator shows; release → `name` moves there.
5. Open Hide-fields panel → confirm `name` is in the new position
   in the panel's list.
6. Try to drag primary header → no drag starts.
7. Try to drag a non-primary header to before primary (drop
   between viewport-left and primary's right edge) → no drop
   indicator; release is a no-op.
8. Apply a sort on `iCFA factor` → sort active. Drag `iCFA
   factor` header to a new position → sort still active, sort
   indicator now renders at the new position.
9. Apply a Group by `floor_level` → grouping active. Drag
   another column → group header re-renders against new order.
10. Tab to header B (visible focus). Press Space → header
    becomes "picked up" (outline). Announce: "Picked up X. Use
    arrow keys to move."
11. Press → twice → drop position shifts visually. Press Space →
    commit. Announce: "Moved to position N."
12. Tab to another header, press Space, press Esc → cancel.
    Announce: "Canceled."
13. Mouse-down on a non-primary header but release without
    moving (or move < 8 px) → drag does NOT start; column-select
    fires (existing Phase 3 behavior).
14. Hide a column via panel, then drag headers around → hidden
    column's position relative to siblings preserved when shown
    again.
15. Chrome + Safari + (optional) iPad — repeat 4, 8, 11 in each.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — sortable header cells            | | | |
| 2 — keyboard reorder                 | | | |
| 3 — demo + integration               | | | |
| Plan 08 overall                      | | | |
