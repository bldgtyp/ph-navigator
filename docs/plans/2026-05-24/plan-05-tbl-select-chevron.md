---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Fifth in the 9-plan AirTable-parity polish series.
        Sequenced 5/9.
SCOPE: Add an AirTable-style chevron-down indicator to active
       single-select cells, with click / keyboard / type-to-edit
       routing into the existing `SingleSelectPopover`. Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-SELECT-1)
RELATED:
  - frontend/src/shared/ui/data-table/components/SingleSelectPopover.tsx
    (existing popover — opened on cell click today; this plan adds a
    chevron trigger + keyboard entry points)
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
    (cell render path; chevron mounts here for single-select active
    cells)
  - frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts
    (the type-to-edit handler from plan 04 needs a single-select
    branch added — see §2 constraint 5)
  - frontend/src/shared/ui/data-table/fields/registry.ts
    (field-type lookup so the cell renderer knows it's
    `single_select`)
---

# Plan 05 — Single-select chevron + dropdown picker

## 1. Why this plan exists

Single-select cells today render their option pill but offer no
affordance that they're editable. The user has to know (from
muscle memory or trial-and-error) that clicking opens
`SingleSelectPopover`. AirTable solves this with a small
chevron-down icon on the active single-select cell — instantly
telling the user "this opens a list" (image #2 from Ed's
2026-05-24 review).

Two related improvements ride along:

1. **Keyboard entry into the popover.** Enter / F2 / Space on an
   active single-select cell opens the popover, focused on the
   current option.
2. **Type-to-edit pre-fills the popover search.** When plan 04's
   type-to-edit lands, typing any printable char on an active
   single-select cell opens the popover with the typed char in the
   search input. AirTable parity.

## 2. Binding constraints

1. **Library-only.** Edits in `GridBody.tsx`, `SingleSelectPopover.tsx`
   (small additions), `useGridKeyboard.ts` (single-select branch
   for type-to-edit), and CSS. Zero consumer touches.
2. **Chevron renders only on active single-select cells.** Inactive
   cells show no chevron. Read-only mode / locked-version / Viewer
   hides the chevron.
3. **The existing click-anywhere-on-cell-opens-popover behavior is
   preserved.** Plan does not regress it; chevron is an additional
   affordance, not a replacement.
4. **Popover content is unchanged** (search input, pill list,
   inline-create). Only the trigger surface gains a chevron click
   path.
5. **Type-to-edit (plan 04) routes single-select cells to the
   popover, not the inline editor.** Plan 04 skips single-select
   in its handler; this plan adds a parallel branch that opens the
   popover with the typed char pre-filling the search input.
6. **Chevron is visually subtle** — small, neutral foreground,
   anchored at the cell's right edge. Should not compete with the
   option pill's color.
7. **No fill-handle conflict.** The chevron sits at the right edge
   (top-aligned or vertically centered); the fill handle sits at
   the bottom-right corner. They don't overlap when both are visible
   (active cell + handle present).

## 3. Acceptance criteria

1. **Chevron renders on active single-select cell.** Click a
   `floor_level` cell → chevron-down icon appears at the cell's
   right edge.
2. **Chevron absent on inactive cells.** All other `floor_level`
   cells in the column show no chevron.
3. **Chevron absent on non-single-select cells.** Active `name`
   (text) cell shows no chevron.
4. **Click chevron opens popover.** Click the chevron → existing
   `SingleSelectPopover` opens anchored to the cell.
5. **Click cell body still opens popover.** Click the pill area of
   an active single-select cell → popover opens. (No regression.)
6. **Enter / F2 / Space open popover with current option focused.**
   Active single-select cell, press Enter → popover opens, current
   option's row is highlighted in the list.
7. **Type-to-edit opens popover with pre-filled search.** Active
   single-select cell, press `B` → popover opens, search input
   contains `"B"`, list is filtered to options matching `"B"`.
   ↑/↓ navigate; Enter selects; Escape cancels.
8. **Escape closes popover** without writing.
9. **Click-outside closes popover** without writing.
10. **Read-only / locked-version hides chevron.** Active single-
    select cell in viewer mode → no chevron. (Click still opens
    the popover in read-only-display mode — see §7.)
11. **Fill handle + chevron coexist.** Active single-select cell
    with no edit in progress → both chevron (right edge) AND fill
    handle (bottom-right corner) render without visual overlap.
12. **No regression** to existing single-select behavior: pill
    color, inline-create, match-or-create on paste, drag-fill
    (Phase 7), ⌘D / ⌘R fill.

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  components/
    GridBody.tsx             extended: when the active cell is a
                             single-select column AND not read-only,
                             render a chevron `<button>` overlay
                             alongside the cell content. Wire its
                             onClick to open the popover.
    SingleSelectPopover.tsx  extended: accept an optional
                             `initialSearch?: string` prop. When set,
                             initialize the internal search-input
                             state with that string and filter the
                             options list accordingly.
    GridChevron.tsx          NEW (small) — pure presentational button
                             with the chevron-down SVG, anchored at
                             the cell's right edge. ~25 LOC.
  hooks/
    useGridKeyboard.ts       extended: add a single-select branch to
                             the type-to-edit handler (plan 04) that
                             calls `onOpenSingleSelectPopover(addr,
                             initialSearch)` instead of the inline-
                             editor path. Also: Enter / F2 / Space on
                             active single-select cell open the
                             popover with no pre-fill.
    useGridEdit.ts           UNCHANGED — single-select editing
                             doesn't use the inline-editor state
                             machine; the popover manages its own.
```

### 4.2 Chevron component sketch

```tsx
// components/GridChevron.tsx
import { ChevronDown } from "lucide-react";

export type GridChevronProps = {
  onMouseDown: (event: React.MouseEvent) => void;
  ariaLabel?: string;
};

export function GridChevron({ onMouseDown, ariaLabel = "Open options" }: GridChevronProps) {
  return (
    <button
      type="button"
      className="data-table-cell-chevron"
      aria-label={ariaLabel}
      tabIndex={-1}
      onMouseDown={(event) => {
        // Stop the cell's own click handler from racing the popover
        // open; the chevron's mousedown opens explicitly.
        event.stopPropagation();
        onMouseDown(event);
      }}
    >
      <ChevronDown />
    </button>
  );
}
```

CSS:

```css
.data-table-cell-chevron {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--muted-foreground, #6b7280);
  cursor: pointer;
  z-index: 1;
}
.data-table-cell-chevron svg {
  width: 12px;
  height: 12px;
}
.data-table-cell-chevron:hover {
  color: var(--foreground, #111827);
}
```

### 4.3 SingleSelectPopover prop addition

```tsx
// SingleSelectPopover.tsx — extend props
export type SingleSelectPopoverProps = {
  // ...existing props
  initialSearch?: string;
};

// Internal state:
const [search, setSearch] = useState(props.initialSearch ?? "");

// Effect: if initialSearch changes (popover re-opened with a
// different pre-fill), reset the search.
useEffect(() => {
  setSearch(props.initialSearch ?? "");
}, [props.initialSearch]);
```

### 4.4 Keyboard wiring

`useGridKeyboard.ts` adds a check: when the active cell's column is
single-select, the type-to-edit path routes to
`onOpenSingleSelectPopover(addr, key)` instead of the inline
editor. Enter / F2 / Space route to
`onOpenSingleSelectPopover(addr, "")` (no pre-fill, popover focuses
the current option).

`DataTable.tsx` is the wiring layer: it owns the popover state
(currently driven by cell-click) and passes the open-popover
callback into the keyboard hook.

### 4.5 Test plan

- **`GridChevron.test.tsx` (NEW)** — small component test:
  - Renders the SVG.
  - Calls `onMouseDown` on click.
  - `event.stopPropagation()` is called (asserted via spy).
- **`SingleSelectPopover.test.tsx` (extension):**
  - `initialSearch="B"` pre-fills the search input.
  - Options list is filtered to matching options on open.
- **`GridBody.test.tsx` (extension):**
  - Active single-select cell renders the chevron.
  - Active text cell does NOT render the chevron.
  - Read-only mode hides the chevron on active single-select cells.
- **`useGridKeyboard.test.ts` (extension):**
  - Type-to-edit on active single-select cell calls
    `onOpenSingleSelectPopover(addr, "B")` (not `onTypeToEdit`).
  - Enter on active single-select cell calls
    `onOpenSingleSelectPopover(addr, "")`.
  - F2 same as Enter.
  - Space same as Enter.
- **`DataTable.test.tsx` (extension):**
  - End-to-end: click chevron → popover opens.
  - Press Enter on single-select active cell → popover opens.
  - Type `B` → popover opens with `"B"` in search.

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Chevron component + body wiring

- Create `GridChevron.tsx` per §4.2.
- Extend `GridBody.tsx`: when active cell is a single-select column
  + not read-only, render the chevron.
- Add CSS to `App.css`.
- Wire chevron's `onMouseDown` to the same callback the cell-body
  click uses (popover open).
- Tests: `GridChevron.test.tsx`, `GridBody.test.tsx` extensions.
- Commit: `feat(data-table): chevron indicator on active single-
  select cell`.

### Step 2 — SingleSelectPopover pre-fill

- Add `initialSearch` prop to `SingleSelectPopover.tsx`.
- Wire internal search state to honor it.
- Tests: `SingleSelectPopover.test.tsx` extensions.
- Commit: `feat(data-table): SingleSelectPopover accepts
  initialSearch`.

### Step 3 — Keyboard routing

- Extend `useGridKeyboard.ts`: add single-select branches for
  type-to-edit (routes to popover with pre-fill) and Enter / F2 /
  Space (routes to popover without pre-fill).
- Wire `DataTable.tsx` to pass `onOpenSingleSelectPopover` into the
  keyboard hook.
- Tests: extend `useGridKeyboard.test.ts`, `DataTable.test.tsx`.
- `make typecheck && make lint && make test`.
- `make dev`, walk §10.
- Commit: `feat(data-table): keyboard opens single-select popover`.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Chevron click and cell-body click both fire when the chevron is clicked (event bubbling). | `GridChevron.onMouseDown` calls `event.stopPropagation()` before invoking the callback. The cell's own onMouseDown receives no event. Tested with a spy. |
| The chevron overlaps the option pill's text when the pill is wide. | The pill's render reserves right padding (e.g., `padding-right: 24px`) when an active-cell chevron may render. Adjust the existing single-select pill CSS to leave room for the 16 px chevron + 4 px right offset. |
| The chevron is visible during inline-edit mode on adjacent text cells — visually noisy if neighbors render it. | Chevron renders ONLY on the active cell, and an active cell is by definition a single cell. Only one chevron is ever visible at a time. |
| `initialSearch` prop change after popover opens triggers extra effect runs. | The effect resets state only when `initialSearch` itself changes; re-renders with the same value are no-ops (`useEffect` dependency check). |
| Plan 04's `useGridKeyboard` already has a type-to-edit handler that skips single-select cells. This plan adds back the single-select case via a different routing — depends on plan 04's `isSingleSelectColumn` guard being a function this plan can reach. | Both plans live in the same hook; the guard is shared. Step 3 of this plan replaces the skip with a route-to-popover branch in the same conditional block. |
| The chevron's `cursor: pointer` competes with the cell's `cursor: default` — flicker on mouse-over the right 16 px of the cell. | The chevron is `z-index: 1` and has its own cursor; the cell's cursor applies elsewhere. Smooth transition, no flicker. |
| Fill handle (6×6) and chevron (16×16 at right edge, vertically centered) could overlap on short cells (e.g., a row height of ~22 px would have the chevron's vertical center at 11 px and the fill handle at row-height − 3 px = 19 px; the chevron's bottom edge ~19 px and fill handle's top edge ~13 px would overlap). | At Rooms' default row height (~32 px), no overlap. If a future denser variant lands, shift the chevron to top-right (8 px from top) to clear the fill handle. Not a concern today. |

## 7. What this plan explicitly does not do

- Does not change the popover's content layout (search input, pill
  list, inline-create button).
- Does not add a multi-select column type — out of scope (US-Builder-
  Tables only specifies single-select).
- Does not change paste's match-or-create pipeline.
- Does not change the pill's color or shape.
- Does not provide a "read-only" popover variant for viewer mode —
  the popover in viewer mode is currently disabled entirely (click
  does nothing); this plan does NOT change that.
- Does not add a keyboard shortcut to close the popover other than
  Escape.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — chevron component + body wiring  | 1.0 | 1.5 |
| 2 — popover pre-fill                 | 0.5 | 1.0 |
| 3 — keyboard routing                 | 1.0 | 1.5 |
| **Total**                            | **2.5** | **4.0** |

About half a workday.

## 9. Commit plan

1. `feat(data-table): chevron indicator on active single-select
   cell`
2. `feat(data-table): SingleSelectPopover accepts initialSearch`
3. `feat(data-table): keyboard opens single-select popover`

## 10. Demo script

1. `make dev`, open Rooms. Ensure rows have `floor_level` options
   populated.
2. Click row 3 `floor_level` cell → chevron-down icon appears at
   the cell's right edge.
3. Click chevron → popover opens. Click outside → popover closes.
4. Click row 3 `floor_level` pill body → popover opens (existing
   behavior preserved).
5. Click row 4 `floor_level` → chevron moves to row 4; row 3 no
   longer shows chevron.
6. Active single-select cell. Press Enter → popover opens with
   current option focused (highlight on the row).
7. Press F2 → same.
8. Press Space → same.
9. Press `B` → popover opens with `"B"` in search input; option
   list filtered to "Basement" (or whatever matches).
10. Press ↓ / ↑ to navigate. Enter to select. Cell updates.
11. Active text cell (e.g. `name`) — no chevron. Plan 04's
    type-to-edit still routes to the inline editor.
12. Switch to viewer mode → active single-select cell shows no
    chevron.
13. Active single-select cell, no edit in progress: chevron at
    right edge AND fill handle at bottom-right corner both
    visible, no overlap.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — chevron component + body wiring  | | | |
| 2 — popover pre-fill                 | | | |
| 3 — keyboard routing                 | | | |
| Plan 05 overall                      | | | |
