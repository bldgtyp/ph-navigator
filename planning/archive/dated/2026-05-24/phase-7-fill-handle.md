---
DATE: 2026-05-24
TIME: planning
STATUS: Walked with Ed 2026-05-24; all ten §12 open questions
        resolved inline (see §12). Ed supplied one AirTable
        reference screenshot of the fill handle on an active
        single-select cell (in-context only; the on-disk path he
        cited did not persist). From the screenshot the handle is
        a small (~6 px) solid blue filled square centered on the
        active cell's bottom-right corner, the same blue as the
        perimeter outline (Phase 3 `var(--accent-text)`), with no
        border. §4.1's CSS rule + §4.2 visibility logic update to
        match: handle is 6 × 6, color `var(--accent-text)`,
        positioned `right: -3px; bottom: -3px` so half the square
        sits inside the cell and half outside, overlapping the
        outline corner exactly the way AirTable does. Plan
        otherwise unchanged from the original draft. The plan is
        still shaped to absorb the small refinements still
        possible in Phase 5 (single-select) and Phase 6 (grouping)
        without re-planning Phase 7 — the only Phase-6 surface
        Phase 7 couples to is `bodyPlan` + `view.group` +
        `view.expandedGroups`, and that contract is settled (see
        §2 constraint 4 below). Ready to begin Step 1.

        **Material delta from parent plan §13.** Parent §13 says
        "Disabled while grouped (banner 'Ungroup to fill')." Per Ed
        2026-05-24, **fill is NOT disabled while grouped**. Instead
        the fill rectangle is **clamped to the active row's
        innermost group** — the handle still appears, the drag still
        works, but the user cannot drag past the bottom (or top) row
        of the current group. ⌘D / ⌘R behave identically. This makes
        fill the only data-write gesture that composes with grouping
        rather than being suppressed by it (paste stays blocked —
        paste plans cross-row writes from a clipboard whose shape
        cannot reason about group boundaries; fill plans writes from
        a known in-table source rectangle whose group can be derived
        deterministically).
SCOPE: Phase 7 of the `<DataTable>` AirTable-parity plan. Three
       deliverables, all library-only:
       (1) **Fill handle** — a small square drag affordance anchored
           at the bottom-right corner of the active source rectangle.
           Visible when the source is non-degenerate or a single
           active cell, edit mode is off, the table is writable, and
           the source rectangle sits inside one group (when grouped).
           Drag extends the fill rectangle along the dominant pointer
           axis (vertical or horizontal — whichever has the larger
           delta at any moment), with auto-scroll and document-level
           pointer tracking reusing the Phase 3 `useGridPointerDrag`
           plumbing (a third `mode: "fill"` lane). On mouse-up the
           fill commits as one semantic `WriteOp.kind = "fill"` so ⌘Z
           reverts all written cells in one entry.
       (2) **⌘D fill down / ⌘R fill right** — keyboard equivalents
           that act on the current selection range. The top row of
           the range is the source for ⌘D; the leftmost column for
           ⌘R; the rest of the range is the target. No drag, no
           handle — same write reducer path.
       (3) **Group-clamped fill** — when `view.group.length > 0`,
           every fill (drag or keyboard) is restricted to data rows
           whose innermost group `pathKey` matches the source range's
           anchor row. The handle hides when the source spans more
           than one group; the drag target clamps to the group's
           visible bounds; ⌘D / ⌘R writes stop at the group bottom /
           edge. Paste-while-grouped stays blocked (existing Phase 4
           behavior preserved); fill is the only mid-group data-write
           gesture.
       Driven against Rooms (US-EQ-2). No consumer touches: zero
       changes to `RoomsTable.tsx`, `EquipmentTab.tsx`, or anything
       under `features/`. Closes parent-plan §13 (Phase 7) with the
       group-clamping refinement noted above. After Phase 7, the
       AirTable parity gate (parent §17) is fully closed — only the
       catalog-page migration (parent §14) and post-parity
       extensions (parent §16) remain.
PARENT-PLAN: planning/archive/dated/2026-05-23/datatable-airtable-parity.md
PRECEDING-PHASE: planning/archive/dated/2026-05-24/phase-6-group-accordion-aggregations.md
RELATED:
  - context/technical-requirements/data-table.md
    (§Interaction Requirements: "fill handle on the active range,
    cyclic repeat only"; §Write Reducer: "WriteOp.kind = 'fill'
    is the single primitive for any extend-by-repetition write")
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 11 — keyboard accelerators for
    repetitive cell entry; criterion 13 — grouping invariants —
    fill must compose with the accordion the same way ⌘Z does)
  - planning/archive/dated/2026-05-23/phase-3-pointer-drag-selection.md
    (`useGridPointerDrag` orchestration, document-level pointer
    tracking, EDGE_PX / SCROLL_PX auto-scroll loop, two existing
    drag modes "cell" / "column" — Phase 7 adds "fill" as the
    third)
  - planning/archive/dated/2026-05-23/phase-0-foundation-refactor.md
    (write reducer + history contract; `dispatchWrite(op, inverse)`
    chokepoint that paste, single-select create-on-edit, row insert
    / delete, option mutation, and now fill all share)
  - planning/archive/dated/2026-05-24/phase-6-group-accordion-aggregations.md
    (`bodyPlan` discriminated union; `visibleDataRows`; group
    `pathKey` shape from `lib.ts:groupPathKey`; the existing
    `isGrouped` guard at `DataTable.tsx:169` that paste already
    consults — Phase 7 reads `view.group` + `bodyPlan` to derive
    per-row group keys)
  - research/poc-plans/poc-lessons-for-real-build.md
    (L1.1 stable-id selection state, L3.2 box-shadow channel for
    selection — the handle is rendered outside the box-shadow
    lanes so it doesn't fight the perimeter outline, L4.3 single
    paste-rectangle planner — Phase 7's fill planner is the
    same shape minus the clipboard-shape branch, L5.3 document-
    level pointer tracking, L6.1 one write primitive, L6.2
    semantic undo entries, L7.1 fill drag reuses the selection
    controller pattern, L10.2 native controls)
---

# Phase 7 — Fill handle + ⌘D / ⌘R

## 1. Why this phase exists

After Phases 0–6, every AirTable interaction the parent plan lists
runs through `<DataTable>` **except** extend-by-repetition writes —
the bottom-right square handle on the active range, ⌘D, ⌘R. Every
PH-Navigator consumer that this primitive backs (Rooms today,
Thermal Bridges / ERVs / Pumps / Fans / catalog pages tomorrow)
needs them: filling 30 ERV-IDs down a column, repeating an
assembly choice across 20 rooms on the same floor, and broadcasting
one room's iCFA factor across its zone are routine workflows.
Without fill, the only way to do those today is paste from Excel
(loses option-id resolution against the project's own option
list) or edit each cell by hand (tedious past a handful of rows).

Five concrete gaps Phase 7 closes:

1. **No fill handle anywhere.** The active range renders a
   perimeter outline (Phase 3 §4.10), but no drag affordance
   sits at its corner. Every other AirTable-class grid puts a
   small square there; absent it, users default to copy-paste
   for any repeat write — losing the semantic undo grouping the
   write reducer already gives every other gesture.
2. **No ⌘D / ⌘R.** Excel users reach for these reflexively;
   PH-Navigator consumers who came from PHPP spreadsheets have
   asked for them by name (criterion 11). The library has no
   handler for either today.
3. **`WriteOp.kind = "fill"` is declared but unused.** The op
   already lives in the `WriteOp` union (`types.ts:161`) as a
   forward-compat slot Phase 0 reserved. No code path emits it.
   Phase 7 wires it.
4. **Fill-while-grouped invariant unresolved.** Parent §13
   defaults to "disabled while grouped, banner Ungroup to fill" —
   matching the paste guard. Per the 2026-05-24 walk with Ed,
   that's the wrong default for fill: the source rectangle for
   a fill is always a contiguous in-table selection whose group
   membership can be derived deterministically from `bodyPlan`,
   so clamping to the group is both safe and useful (a typical
   fill-down-a-floor gesture is exactly the workflow Rooms
   needs). Paste stays blocked because its source is a clipboard
   payload whose shape cannot reason about group boundaries.
5. **`useGridPointerDrag` has two modes (`cell`, `column`) but
   was built to host more.** Phase 3 §4.3 designed the hook so
   a third drag lane could plug in without re-engineering the
   document-level listener setup / auto-scroll / teardown. Phase
   7 plugs in `mode: "fill"`. This is the case L7.1 records as
   the rationale for that hook design.

After Phase 7, the toolbar carries no new buttons (fill has no
toolbar surface — it lives entirely on the body), the active
range carries one new pixel-perfect square at its bottom-right
corner whenever a fill source is well-formed, and the write
reducer emits one new op kind. Every other Phase 0–6 invariant
holds unchanged: selection, perimeter outline, focus, tint
cascade, group accordion, aggregations, popovers, all compose
underneath the new handle.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/` plus `frontend/src/App.css`
   for the fill-handle styling and (one rule) the cursor change
   during a fill drag. **Zero touches** to `RoomsTable.tsx`,
   `EquipmentTab.tsx`, or anything under `features/`. If a
   consumer file changes during this phase, pause and re-evaluate
   (mirrors Phases 4–6's binding constraint #1).
2. **`dispatchWrite` is the only mutation channel for fill** (PoC
   L6.1). Every gesture — drag-commit on mouseup, ⌘D, ⌘R — calls
   `dispatchWrite(op, inverse)` exactly once where `op.kind ===
   "fill"` and `inverse.kind === "cell"`. Forward and inverse are
   constructed in one place (`useGridFill` per §4.1). No fill code
   touches the consumer's `onWrite` directly; the reducer is the
   chokepoint.
3. **One semantic history entry per fill.** A drag that writes
   N×M cells lands as one `HistoryEntry`; ⌘Z reverts every written
   cell in a single step (L6.2). The inverse op carries the
   previous values for every written cell — the same shape paste
   already builds in `useGridClipboard.buildPasteInverse`.
4. **`bodyPlan` + `view.group` are the only group-shape inputs.**
   The fill planner reads `bodyPlan` (the data-row subset) and
   walks `view.group` indirectly via the data items' parent group
   `pathKey`s. It does NOT recompute group membership from raw
   rows + group rules; that derivation belongs to `buildBodyPlan`
   and stays there (§4.5 below uses a per-data-item helper that
   reads from the already-built plan). When Phase 5 / 6 refine
   the group surface (option label tweaks, popover labels, tint
   sampling), Phase 7's planner stays untouched.
5. **Fill across columns reuses per-column field types** (L2.3).
   Each column in the source rectangle carries its own field type;
   the cyclic repeat writes a value into a target cell using the
   *target* cell's column's field type for coercion. In practice
   this is a no-op coercion (the source and target share the same
   column, so the field type matches) — but the planner threads
   the value through `coerceFieldValue` anyway so the contract
   stays "every cell write passes through the registry," matching
   paste.
6. **Read-only cells in the target are skipped.** A fill rectangle
   that crosses a read-only column writes nothing into that
   column's cells. The writes for editable columns still commit;
   the announce-region message reports the skip count. Matches
   paste's behavior in `coercePasteWrites`.
7. **Single-select fill copies option_id verbatim.** Source and
   target share a column (and therefore an option list), so the
   cyclic value is the same `option_id` string. No option creation
   happens during fill — fill is a strict in-table repeat. (Paste
   creates options on the fly; fill cannot, because the source is
   already in the table and therefore already references valid
   option ids.) Consequently the `WriteOp.kind = "fill"` payload
   carries no `OptionListDelta` slot — the existing
   `{ kind: "fill"; writes: CellWrite[] }` shape is sufficient.
8. **Edit-mode disables fill.** When `edit.editing` is non-null,
   the handle hides, the ⌘D / ⌘R shortcuts are inert, and any
   drag-in-progress aborts (the existing
   `isPointerInActiveEditor` guard already blocks new drag
   sessions from starting inside the editor; Phase 7 adds an
   abort-on-edit-start path for safety).
9. **Read-only mode hides the handle entirely.** A viewer / locked-
   version reader sees no handle, ⌘D / ⌘R are no-ops with an
   announce-region message "Editing not available." Matches the
   Phase 1 / 2 inline-edit gating.
10. **No new top-level npm dependencies.** `@dnd-kit/sortable`
    (Phase 4), `@radix-ui/react-popover` (Phase 4), and
    `@radix-ui/react-dialog` (Phase 5) cover every UI primitive
    Phase 7 needs. The fill handle is plain HTML/CSS anchored
    inside the bottom-right cell — no portal, no popover, no
    drag library.
11. **Tests live with the primitive.** New coverage lands in
    `__tests__/fillPlanner.test.ts`, `__tests__/useGridFill.test.ts`,
    `__tests__/FillHandle.test.tsx`, plus extensions in
    `DataTable.test.tsx`, `GridBody.test.tsx`,
    `useGridKeyboard.test.ts`, and
    `useGridPointerDrag.test.ts`. Consumer integration tests
    (`EquipmentTab.test.tsx`) get no behavior changes.
12. **Selection model unchanged.** Fill does NOT mutate the
    selection range. After a drag-fill, the selection stays on
    the **fill target rectangle** (anchor at source top-left,
    focus at fill-target bottom-right) so the user can chain
    another gesture against the just-filled cells. After ⌘D /
    ⌘R, the selection stays exactly where it was (no change).
    Matches AirTable.

## 3. Acceptance criteria

"Phase 7 demo passed" means all sixteen are true on a real
browser walk against Rooms.

1. **Handle renders at the bottom-right of the source.** With a
   single active cell on `floor_level` row 3, a small (~8 × 8 px)
   square appears at the cell's bottom-right corner, inside the
   perimeter outline. With a multi-cell range, the handle sits
   at the bottom-right of the normalized rectangle's last cell.
2. **Handle hides in the expected cases.** No handle when: edit
   mode is active, `readOnly === true`, `onWrite` is undefined,
   the source rectangle spans more than one group (grouped only),
   or `visibleDataRows` is empty. The CSS attribute selector
   `[data-fill-handle="true"]` on the source's bottom-right cell
   is the only signal — no JS recompute of position on scroll
   (the handle moves with its anchor `<td>` for free).
3. **Fill down extends a single cell down 10 rows.** Click row 3
   `name`, drag the handle to row 13. Rows 4–13 receive the row-3
   value; the announce region reads `10 cells filled.`. The
   selection range becomes (row 3 → row 13, columns name → name).
4. **Fill right extends across columns.** Click row 3 column
   `iCFA factor`, drag the handle right to `num_people`. Columns
   between receive row-3 iCFA value; per-column coercion turns
   the value into the right shape for each column (no-op when
   the column type matches; skip-with-announce when a column is
   read-only).
5. **Dominant-axis pick on a diagonal drag.** Start a drag,
   move 30 px down + 5 px right → the fill goes vertical only;
   move 5 px down + 40 px right → horizontal only. The axis
   commits the first time `|dy| > AXIS_THRESHOLD || |dx| >
   AXIS_THRESHOLD` and stays locked for the rest of the session
   (no axis-flip mid-drag). `AXIS_THRESHOLD = 8 px`.
6. **Cyclic repeat from a multi-cell source.** Select rows 3–5
   on `name` (three values "ERV-A", "ERV-B", "ERV-C"), drag the
   handle down to row 12. Rows 6–12 receive
   `[ERV-A, ERV-B, ERV-C, ERV-A, ERV-B, ERV-C, ERV-A]`. Row 3–5
   themselves are not rewritten.
7. **Single-cell source = constant fill.** Cyclic with cycle
   length 1 collapses to a constant — repeating one value into
   every target cell. No special branch; same code path.
8. **⌘D fills the selection downward.** Select rows 3–10 on
   `floor_level`, press ⌘D. Rows 4–10 receive the row-3
   `floor_level` option_id. Selection stays at rows 3–10. The
   announce region reads `7 cells filled.`. A single-row
   selection makes ⌘D a no-op (announce: `Select more than one
   row to fill down.`).
9. **⌘R fills the selection rightward.** Select row 3, columns
   `iCFA factor` → `num_people`. Press ⌘R. Columns to the right
   of `iCFA factor` receive its value (coerced per-column).
   Selection stays. A single-column selection makes ⌘R a no-op
   (announce: `Select more than one column to fill right.`).
10. **Group clamp — drag.** Group Rooms by `floor_level`. Click
    row 3 `name` (let's say it's the second room under
    `floor_level = 1st`, which has 4 rooms total in
    `visibleDataRows`). Drag the handle down past the bottom of
    the `1st` group toward the `2nd` group's first room. The
    fill target visually stops at the last `1st`-group row; the
    handle's drag-preview rectangle does not extend across the
    group boundary; releasing the mouse fills only rows 4 of the
    `1st` group, not anything in `2nd`. The announce region
    reports `Fill clamped to group bottom.` once per session.
11. **Group clamp — ⌘D.** With the same group active, select
    rows 3–10 spanning the boundary between `floor_level = 1st`
    and `floor_level = 2nd` (rows 3–5 are `1st`, rows 6–10 are
    `2nd`). Press ⌘D. ⌘D treats each contiguous within-group
    sub-range as its own fill (`1st`: rows 3–5, source row 3,
    target rows 4–5; `2nd`: rows 6–10, source row 6, target
    rows 7–10). Both sub-fills land in one semantic op — one
    history entry; ⌘Z reverts both.
12. **Group clamp — handle hides on cross-group source.** With
    group active, Shift+Click selects rows 3–10 spanning two
    groups → the perimeter outline still renders, but the
    bottom-right handle disappears (the source rectangle is
    not a single-group source so drag-fill has no well-defined
    target; ⌘D / ⌘R can still be used because they have an
    explicit per-group splitting rule). The toolbar / banner
    surface stays silent — no toast.
13. **Auto-scroll during drag.** Drag the handle past the bottom
    of the viewport; the container scrolls down at `SCROLL_PX`
    per frame (reuses `useGridPointerDrag`'s loop); the fill
    target follows the pointer; group-clamping still applies
    (the autoscroll target row is re-clamped each frame).
14. **Read-only cells skipped.** Fill a range that includes a
    read-only computed column → the editable columns commit;
    the read-only column is silently skipped; announce includes
    `(N skipped, read-only)`.
15. **⌘Z reverts the whole fill.** After any fill (drag or
    keyboard, group-clamped or not), ⌘Z restores every written
    cell's previous value in one step. ⌘⇧Z re-applies. Matches
    paste's history semantics exactly.
16. **No Phase 0/1/2/3/4/5/6 regressions.** All Phase-6-post
    tests pass. Inline edit, paste (still blocked while
    grouped), row insert / delete, mouse-drag range selection
    (no fill-handle interference at the source-rectangle
    bottom-right), perimeter outline, autoscroll, Phase 4
    filter / sort popovers, Phase 5 option editor, Phase 6
    group accordion / aggregations / 7-subset tint cascade all
    work unchanged. `make typecheck && make lint && make test
    && make format` and `pnpm run build` are clean. `pnpm run
    dev` walks §10 end-to-end in Chrome and Safari without
    console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              composes the fill wiring: builds the
                             per-source-cell `groupPathByRowId` map
                             from bodyPlan; passes it + selection +
                             dispatchWrite into the new
                             `useGridFill` hook; threads
                             `fill.source` + `fill.targetPreview` +
                             `fill.handleVisible` into GridBody so
                             the right cell renders the handle.
                             Reads `fill.fillDown` / `fill.fillRight`
                             into the keyboard hook for ⌘D / ⌘R.
                             Stays under ~340 LOC (Phase 6 leaves
                             it around 280–310).
  components/
    GridBody.tsx             extended — accepts `fill.source` (the
                             normalized range), `fill.targetPreview`
                             (the clamped target rectangle during a
                             drag, null otherwise), and
                             `fill.handleVisible` (the boolean from
                             §4.2). Emits the `<FillHandle>` inside
                             the bottom-right cell of `fill.source`
                             when `fill.handleVisible`. Emits a
                             `data-fill-target="true"` attribute on
                             cells inside `fill.targetPreview` so
                             CSS can tint them during the drag.
                             Cell `onMouseDown` skip rule extends:
                             a mousedown that originated on the
                             `<FillHandle>` doesn't start a
                             cell-mode drag.
    FillHandle.tsx           NEW — pure presentational `<button>`
                             positioned via CSS at the cell's
                             bottom-right corner. Calls
                             `fill.onHandleMouseDown(event)` and
                             stops propagation so the cell's own
                             mousedown handler doesn't interpret
                             the click as a range-collapse / range-
                             start gesture.
    GridHeader.tsx           UNCHANGED
    GridToolbar.tsx          UNCHANGED — fill has no toolbar
                             surface (no button, no popover, no
                             status chip). The active-state visual
                             is the handle's presence alone.
    GridGutter.tsx           UNCHANGED
    GroupHeaderRow.tsx       UNCHANGED — group-header rows are not
                             fill targets and do not carry a
                             handle; they have no `data-row-id`
                             so the planner's pointer-to-row
                             resolution null-skips them anyway.
    ColumnHeaderMenu.tsx     UNCHANGED
    AggregationMenuItem.tsx  UNCHANGED
    GroupPopover.tsx         UNCHANGED
    FilterPopover.tsx        UNCHANGED
    SortPopover.tsx          UNCHANGED
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             UNCHANGED
    FieldEditorPopover.tsx   UNCHANGED
    ViewMenuOverflow.tsx     UNCHANGED — Reset view does NOT clear
                             a fill state because fill is not view
                             state (fill writes commit immediately
                             to row data and live in undo history,
                             not in `ViewState`).
  hooks/
    useGridSelection.ts      UNCHANGED — fill never mutates the
                             selection through `useGridSelection`'s
                             setters during the drag; on commit,
                             `useGridFill` calls
                             `selection.setActive` once with the
                             new top-left and `selection.extendTo`
                             once with the bottom-right to land
                             the post-fill selection on the target
                             rectangle (§2 constraint 12).
    useGridFill.ts           NEW — orchestrator hook. Inputs:
                             `selection`, `bodyPlan`,
                             `visibleColumnDefs`, `fieldDefs`,
                             `getRowId`, `dispatchWrite`,
                             `containerRef`, `readOnly`,
                             `isEditing`, `onAnnounce`. Returns:
                             `{ handleVisible: boolean,
                                source: NormalizedRange | null,
                                targetPreview: NormalizedRange | null,
                                onHandleMouseDown:
                                  (event) => void,
                                fillDown: () => Promise<void>,
                                fillRight: () => Promise<void>,
                                isDragging: boolean,
                                cancel: () => void }`.
                             Owns the per-data-row group key map
                             (memoized off bodyPlan), the dominant-
                             axis state machine for the drag, the
                             document-level pointer listeners (same
                             pattern as `useGridPointerDrag` —
                             attach on mousedown, tear down on
                             mouseup), the auto-scroll loop (reuses
                             EDGE_PX / SCROLL_PX constants — Phase
                             7 promotes those from
                             `useGridPointerDrag` to a shared
                             `pointerDragConstants.ts`), and the
                             write-plan builder. The hook does
                             NOT share state with
                             `useGridPointerDrag`; the two hooks
                             run independently and never co-drag
                             (mousedown on the handle blocks the
                             cell-drag path; mousedown on a cell
                             body never reaches the handle path).
    useGridPointerDrag.ts    extended — one small additions:
                             `isPointerInFillHandle(target)` guard
                             alongside the existing
                             `isPointerInActiveEditor`. When the
                             mousedown target is inside the
                             FillHandle button, the cell drag
                             early-returns. The guard lives in
                             `DataTable.tsx`'s
                             `isPointerInActiveEditor` callback,
                             widened to "inside editor OR inside
                             fill handle." No new hook arg.
    useGridKeyboard.ts       extended — accepts two new optional
                             callbacks `onFillDown?: () =>
                             Promise<void>` and `onFillRight?: () =>
                             Promise<void>`. Wired to ⌘D and ⌘R.
                             Mirrors the existing ⌘C / ⌘Z / ⌘⇧Z /
                             ⌘A dispatch surface. When either
                             callback is undefined the key is
                             unhandled (so the browser default
                             takes over — bookmark for ⌘D, reload
                             for ⌘R; matches Excel-style
                             "shortcut only when a grid is
                             focused"). When the callback is
                             defined, `event.preventDefault()` is
                             called before invocation.
    useGridEdit.ts           UNCHANGED
    useGridHistory.ts        UNCHANGED — fill ops push and pop
                             through the same path paste uses
                             (§2 constraint 3).
    useGridWriteReducer.ts   UNCHANGED — `WriteOp.kind = "fill"` is
                             already in the union; the reducer is
                             op-shape-agnostic.
    useGridClipboard.ts      UNCHANGED — paste guard at
                             `DataTable.tsx:507` continues to short-
                             circuit while grouped. Fill takes a
                             different path so the guard does not
                             apply.
    useGridRowSelection.ts   UNCHANGED
    useSortableRules.ts      UNCHANGED
  fields/
    registry.ts              UNCHANGED — fill calls
                             `coerceFieldValue` through the
                             existing registry path.
    aggregations.ts          UNCHANGED
    filterOperators.ts       UNCHANGED
    types.ts                 UNCHANGED
  lib.ts                     extended — adds:
                             - `planFill({ source, target, rows,
                                columns, fieldDefs, getRowId,
                                groupPathByRowId })` →
                               `{ writes: CellWrite[],
                                  inverse: CellWrite[],
                                  skipped: number,
                                  clampedToGroup: boolean }`.
                               Pure helper; the hook calls it once
                               on commit (drag or keyboard) with
                               the target rectangle the hook has
                               already clamped to the group.
                             - `groupPathByRowIdFromBodyPlan(bodyPlan)`
                               → `Map<rowId, pathKey>` derived from
                               the data items' last preceding
                               group header. Pure walk; memoizes in
                               DataTable.tsx off the bodyPlan
                               identity.
                             - `clampRangeToGroup(target, source,
                                groupPathByRowId, rowIds, axis)`
                               → returns a normalized rectangle
                               whose `rowStart`..`rowEnd` is the
                               longest contiguous slice from the
                               source row up-or-down (per axis) of
                               rowIds where `groupPathByRowId[id]`
                               matches the source's anchor row.
                               Horizontal axis = identity (columns
                               don't have group keys).
                             - `splitRangeByGroup(target,
                                groupPathByRowId, rowIds)` →
                               returns an array of normalized
                               sub-rectangles, one per contiguous
                               same-group run within the target.
                               Used by ⌘D when the selection spans
                               multiple groups (each sub-range is
                               filled independently from its own
                               top row, all under one op).
                             - `chooseFillAxis({ source,
                                pointerStart, pointerCurrent,
                                axisThreshold })` →
                               `"vertical" | "horizontal" | null`.
                               Returns null while neither delta
                               has crossed the threshold; locks to
                               the first axis to cross.
                             - `buildFillTargetFromPointer({
                                source, pointerCell, axis })`
                               → returns a normalized rectangle
                               whose source side is preserved and
                               whose opposite side extends to the
                               pointer cell (clamped to grid
                               bounds; group clamp happens in a
                               separate pass).
  tokens/
    pointerDragConstants.ts  NEW — `EDGE_PX = 30`, `SCROLL_PX = 12`,
                             `AXIS_THRESHOLD = 8`. Promoted from
                             `useGridPointerDrag.ts` so
                             `useGridFill.ts` shares the same
                             numbers without duplication.
                             `useGridPointerDrag.ts` updates its
                             top-of-file constants to read from
                             this module (no behavior change).
  types.ts                   extended — exports
                             `FillState` shape consumed by GridBody
                             (`{ source, targetPreview,
                             handleVisible }`). `WriteOp` already
                             has the `fill` variant — no change to
                             the union.
  index.ts                   re-exports `FillState` for tests; the
                             hook stays internal.
  __tests__/                 existing tests preserved; new tests
                             added (see §4.10).
```

`App.css` adds (a) one `.data-table-fill-handle` rule positioning
the handle at the bottom-right of its cell with
`position: absolute; right: -3px; bottom: -3px; width: 6px; height:
6px; background: var(--accent-text); border: 0; padding: 0;
cursor: crosshair; z-index: 2;` — sized + colored to match the
AirTable reference Ed walked 2026-05-24 (small solid blue square
centered on the active outline corner, same blue as the outline
itself), (b) one rule on the source cell
`td:has(.data-table-fill-handle) { position: relative; }` so the
absolutely-positioned handle anchors correctly, (c) one rule
`td[data-fill-target="true"] { background: color-mix(in oklab,
var(--accent) 18%, transparent); }` to tint the drag-preview
rectangle, (d) one rule `body[data-grid-fill-active="true"] {
cursor: crosshair; }` set during the drag so the cursor stays
consistent past the source cell. All four rules are local to
Phase 7 — no Phase 6 tokens change.

### 4.2 Fill-handle visibility

The handle renders inside the source rectangle's bottom-right
`<td>` exactly when **all** the following are true:

```ts
// Pseudocode — actual computation lives in useGridFill.
const handleVisible =
  !readOnly &&
  !isEditing &&
  Boolean(onWrite) &&
  visibleDataRows.length > 0 &&
  source !== null &&                     // there's a valid source rectangle
  sourceFitsInOneGroup(source, groupPathByRowId, rowIds);
```

The source rectangle is always derived from `selection`:
- Single active cell → source is `(activeRow, activeCol) ×
  (activeRow, activeCol)` (1×1).
- Explicit range → source is `normalizedRange`.

`sourceFitsInOneGroup` walks `rowIds` between
`normalizedRange.rowStart` and `normalizedRange.rowEnd` and
returns `true` iff every visible row in that span shares the same
`groupPathByRowId[rowId]` value. Ungrouped views have all
`pathKey === ""` (the empty path), so the check trivially passes.

The bottom-right `<td>` of the source carries the
`data-fill-handle="true"` attribute. CSS does the positioning;
no JS layout work runs on scroll, on selection change, or on
window resize.

### 4.3 Drag mechanics

The drag follows the Phase 3 pattern (L5.3, L7.1) with three
adjustments:

1. **Mousedown source is the handle.** `FillHandle.onMouseDown`
   stops propagation (so the underlying cell's drag handler
   doesn't fire) and calls `useGridFill.onHandleMouseDown(event)`.
   The hook captures the source rectangle (`source` ===
   `selection.normalizedRange` at the moment of mousedown),
   stores the pointer-start coordinate, attaches the same
   `document.mousemove` / `document.mouseup` / `document.pointerup`
   listeners `useGridPointerDrag` does, and starts the auto-
   scroll RAF loop.
2. **Axis lock happens once, on first threshold crossing.** On
   every mousemove, the hook calls
   `chooseFillAxis({ source, pointerStart, pointerCurrent,
   axisThreshold: 8 })`. While the function returns `null`, the
   `targetPreview` is just the source (no visual preview yet).
   When it returns `"vertical"` or `"horizontal"`, the hook
   stores the axis in a ref and stops re-deciding for the
   remainder of the session.
3. **Target preview = pointer cell + clamping.** With the axis
   locked, the hook resolves the pointer to a cell via the same
   `elementFromPoint` walk `useGridPointerDrag.resolvePointerToCell`
   uses (closest `td[data-row-id][data-field-key]`). The
   resulting cell address feeds
   `buildFillTargetFromPointer({ source, pointerCell, axis })`,
   which produces a rectangle extending source's chosen-axis
   edge to the pointer cell. Then `clampRangeToGroup` clamps the
   row span to the source's group (vertical axis only; horizontal
   axis is unaffected by grouping). The resulting
   `targetPreview` is what the body tints during the drag.

On `mouseup`, the hook:
1. Calls `planFill` against `targetPreview`.
2. `dispatchWrite(op, inverse)` — one op kind `"fill"`, inverse
   kind `"cell"` carrying previous values for every written cell.
3. Sets selection to the target rectangle (`selection.setActive`
   on the source top-left, then `selection.extendTo` on the
   target bottom-right).
4. Tears down the document listeners + RAF loop (delegated to
   the shared `teardown` factored from `useGridPointerDrag` —
   Phase 7 also extracts that into the new `pointerDragConstants`
   neighbour or inlines a small copy; see §6 risk on factoring).

### 4.4 Axis-dominance rule

`chooseFillAxis` picks the axis whose pointer delta first crosses
`AXIS_THRESHOLD = 8 px`:

```ts
export function chooseFillAxis(args: {
  source: NormalizedRange;
  pointerStart: { x: number; y: number };
  pointerCurrent: { x: number; y: number };
  axisThreshold: number;
}): "vertical" | "horizontal" | null {
  const dx = Math.abs(args.pointerCurrent.x - args.pointerStart.x);
  const dy = Math.abs(args.pointerCurrent.y - args.pointerStart.y);
  if (dx < args.axisThreshold && dy < args.axisThreshold) return null;
  return dy >= dx ? "vertical" : "horizontal";
}
```

Edge cases:
- Equal deltas — vertical wins (AirTable's tie-break behavior
  observed during the 2026-05-24 walk).
- Reverse axis during drag — once locked, the axis stays. A user
  who drags down-then-right keeps a vertical fill; they need to
  release and restart for horizontal.
- Drag back across the source — `buildFillTargetFromPointer`
  collapses the target to the source rectangle (no cells to
  fill) and the commit becomes a no-op (announce: `Fill canceled.`).

### 4.5 Group clamping

The per-row group key map is built from `bodyPlan` once per
identity change. Each `data` item's pathKey is the most recent
`group` item's pathKey at the same or shallower depth — i.e. the
walk records the current path stack as group items appear and
copies it into each data item:

```ts
// lib.ts — sketch
export function groupPathByRowIdFromBodyPlan<TRow>(
  bodyPlan: BodyPlanItem<TRow>[],
): Map<string, string> {
  const map = new Map<string, string>();
  let currentPathKey = "";   // empty path == ungrouped sentinel
  for (const item of bodyPlan) {
    if (item.kind === "group") {
      // The deepest group header for a path carries that path's
      // full pathKey (per buildBodyPlan's emission order). Data
      // items following a group header belong to that group's
      // deepest path.
      currentPathKey = item.pathKey;
      continue;
    }
    map.set(item.rowId, currentPathKey);
  }
  return map;
}
```

`clampRangeToGroup` then trims the vertical axis of any target
rectangle to the contiguous same-group run from the source row:

```ts
export function clampRangeToGroup(
  target: NormalizedRange,
  source: NormalizedRange,
  groupPathByRowId: Map<string, string>,
  rowIds: string[],
  axis: "vertical" | "horizontal",
): { clamped: NormalizedRange; wasClamped: boolean } {
  if (axis === "horizontal") {
    return { clamped: target, wasClamped: false };
  }
  const sourceRowId = rowIds[source.rowStart];
  const sourceGroup = sourceRowId ? groupPathByRowId.get(sourceRowId) ?? "" : "";
  if (sourceGroup === "") {
    return { clamped: target, wasClamped: false };
  }
  let { rowStart, rowEnd } = target;
  // Extend upward from source.rowStart, stopping at the first
  // out-of-group row.
  while (rowStart < source.rowStart) {
    const id = rowIds[rowStart];
    if (!id || (groupPathByRowId.get(id) ?? "") !== sourceGroup) {
      rowStart += 1;
    } else {
      break;
    }
  }
  // Extend downward from source.rowEnd, stopping at the first
  // out-of-group row.
  while (rowEnd > source.rowEnd) {
    const id = rowIds[rowEnd];
    if (!id || (groupPathByRowId.get(id) ?? "") !== sourceGroup) {
      rowEnd -= 1;
    } else {
      break;
    }
  }
  const wasClamped = rowStart !== target.rowStart || rowEnd !== target.rowEnd;
  return {
    clamped: { ...target, rowStart, rowEnd },
    wasClamped,
  };
}
```

The hook calls this on every drag-mousemove (cheap — bounded by
the visible row count) and stores `wasClamped` so it can fire
the announce-region message `Fill clamped to group bottom.` once
per session (on the first clamping mousemove).

### 4.6 Keyboard ⌘D / ⌘R

Both shortcuts derive their source rectangle from the current
selection. The split rules:

**⌘D — fill down within selection.**

- Source rectangle = `selection.normalizedRange` clipped to its
  top row (`rowEnd := rowStart`).
- Target rectangle = `selection.normalizedRange` (the full
  range — rows below the source row are the target).
- If `selection.normalizedRange.rowEnd === rowStart`, no-op +
  announce.
- Group-aware split: when the selection spans multiple groups,
  `splitRangeByGroup(selection.normalizedRange,
  groupPathByRowId, rowIds)` returns N sub-rectangles, one per
  contiguous same-group run. For each sub-rectangle, the source
  is its first row; the target is the rest. All sub-fills
  combine into one `WriteOp.kind = "fill"` (writes are
  concatenated; the op stays one history entry).
- After commit, selection stays unchanged.

**⌘R — fill right within selection.**

- Source rectangle = `selection.normalizedRange` clipped to its
  leftmost column (`columnEnd := columnStart`).
- Target rectangle = `selection.normalizedRange`.
- If `selection.normalizedRange.columnEnd === columnStart`,
  no-op + announce.
- Grouping doesn't affect ⌘R (horizontal axis is group-free) —
  no split, one source per call.
- After commit, selection stays unchanged.

Both calls route through the same `planFill` helper the drag uses;
only the source / target rectangles differ.

### 4.7 Write op + inverse

```ts
// lib.ts — planFill sketch
export type PlanFillResult = {
  writes: CellWrite[];
  inverse: CellWrite[];
  skipped: number;
  clampedToGroup: boolean;
};

export function planFill<TRow>(args: {
  source: NormalizedRange;
  target: NormalizedRange;          // already group-clamped
  rows: TRow[];                     // visibleDataRows
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
}): PlanFillResult {
  const { source, target, rows, columns, fieldDefs, getRowId } = args;
  const fieldDefsByKey = new Map(fieldDefs.map((f) => [f.field_key, f]));
  const writes: CellWrite[] = [];
  const inverse: CellWrite[] = [];
  let skipped = 0;
  const cycleRows = source.rowEnd - source.rowStart + 1;
  const cycleColumns = source.columnEnd - source.columnStart + 1;

  for (let r = target.rowStart; r <= target.rowEnd; r += 1) {
    for (let c = target.columnStart; c <= target.columnEnd; c += 1) {
      // Skip cells that are part of the source rectangle — fill
      // never rewrites its own source.
      if (
        r >= source.rowStart && r <= source.rowEnd &&
        c >= source.columnStart && c <= source.columnEnd
      ) continue;
      const targetRow = rows[r];
      const targetCol = columns[c];
      if (!targetRow || !targetCol) continue;
      const fieldDef = fieldDefsByKey.get(targetCol.fieldKey);
      if (fieldDef?.read_only) {
        skipped += 1;
        continue;
      }
      // Cyclic source coordinate within source.{r,c}Start..End.
      const sr = source.rowStart + ((r - source.rowStart) % cycleRows + cycleRows) % cycleRows;
      const sc = source.columnStart + ((c - source.columnStart) % cycleColumns + cycleColumns) % cycleColumns;
      const sourceRow = rows[sr];
      const sourceCol = columns[sc];
      if (!sourceRow || !sourceCol) continue;
      // Read raw source value through the source column's accessor.
      // Same column for the in-axis case (vertical fill keeps
      // column = c, source.column = c); cross-column case (multi-
      // column source dragged horizontally) reads from sourceCol
      // and writes into targetCol — see §4.9.
      const rawValue = sourceCol.accessor(sourceRow);
      const previousValue = targetCol.accessor(targetRow);
      writes.push({
        rowId: getRowId(targetRow),
        fieldKey: targetCol.fieldKey,
        value: rawValue,
      });
      inverse.push({
        rowId: getRowId(targetRow),
        fieldKey: targetCol.fieldKey,
        value: previousValue,
      });
    }
  }
  return { writes, inverse, skipped, clampedToGroup: false };
}
```

(The `clampedToGroup` field on the result is set by the caller,
not the helper — the helper receives the already-clamped target
rectangle; it can't tell whether clamping happened. The hook sets
the flag from the clamp result and uses it to gate the announce
message.)

`useGridFill.commit()` wraps the planner call:

```ts
const result = planFill({ source, target: clampedTarget, ... });
if (result.writes.length === 0) {
  onAnnounce(result.skipped > 0
    ? `${result.skipped} cells skipped (read-only).`
    : `Fill canceled.`);
  return;
}
const op: WriteOp = { kind: "fill", writes: result.writes };
const inverse: WriteOp = { kind: "cell", writes: result.inverse };
await dispatchWrite(op, inverse);
const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped, read-only)` : "";
const clampNote = clampResult.wasClamped ? " Fill clamped to group bottom." : "";
onAnnounce(`${result.writes.length} cells filled.${skippedNote}${clampNote}`);
```

### 4.8 Coercion & cross-column behavior

For vertical fill (the common case), source column === target
column, so the cyclic value is already type-correct for the
target. No coercion needed.

For horizontal fill across columns of mixed types (e.g. dragging
a number from a number column rightward into a text column), the
planner reads the source's *raw* value via the source column's
accessor and writes it verbatim into the target. The consumer's
`onWrite` is the contract surface — if the consumer rejects the
write because the value doesn't fit the target field's schema,
the dispatchWrite promise rejects, the announce region surfaces
the error, and the history entry is not pushed (write reducer
guarantee in `useGridWriteReducer:42`).

In practice Rooms (the only Phase 7 consumer) doesn't have
mixed-column horizontal-fill scenarios that would cross type
boundaries — `iCFA factor` and `num_people` are both numbers,
`name` and `floor_level` are at different "sides" of the row.
The cross-type case is therefore a theoretical correctness
question, not a usability one; Phase 7 leaves it on the
consumer's `onWrite` contract.

Single-select fill stays simple: source value is an `option_id`
string, target column shares the option list, write commits
verbatim. No `OptionListDelta` rides in the op (§2 constraint 7).

### 4.9 Cyclic repeat semantics

Source = M rows × N columns. Target = T rows × U columns (where
the source rectangle sits at the top-left of the target for
fill-down / fill-right, or — for keyboard ⌘D — the source is the
top row of the target rectangle).

For each target cell `(r, c)`:
- Skip if `(r, c)` is inside the source rectangle (don't rewrite
  source).
- Source coordinates `(sr, sc)` are computed via
  `((delta) % cycle + cycle) % cycle` to handle negative deltas
  cleanly (target rows below the source produce non-negative
  deltas, but the modulo guard makes the formula robust against
  any input).
- Value = `sourceCol.accessor(rows[sr])`.

No pattern detection (e.g. Excel's "Mon, Tue, Wed → fill detects
weekday series"). Cyclic only. The parent plan's "Cyclic repeat
only — no pattern detection (deferred per PoC)" stands.

### 4.10 Test plan

Existing tests pass unchanged (Phase 6 baseline). New tests:

- **`__tests__/fillPlanner.test.ts` (NEW)** — pure helpers:
  - `chooseFillAxis` returns `null` below threshold, `"vertical"`
    when `dy > dx > threshold`, `"horizontal"` when `dx > dy >
    threshold`, `"vertical"` on tie at threshold.
  - `buildFillTargetFromPointer` extends the source's bottom edge
    to a pointer cell below (vertical), the right edge to a
    pointer cell to the right (horizontal); never extends both
    axes in one call.
  - `clampRangeToGroup` returns the target unchanged when axis is
    horizontal; clamps down when target's bottom row leaves the
    source's group; reports `wasClamped` accurately; treats the
    ungrouped `""` sentinel as unrestricted.
  - `groupPathByRowIdFromBodyPlan` produces `""` for every row in
    an ungrouped plan; produces the deepest group's pathKey for
    each data row in a 1-level group; produces the depth-N
    pathKey for data rows under nested groups.
  - `splitRangeByGroup` returns one sub-range when the selection
    sits in one group; N sub-ranges when N groups are touched;
    drops empty sub-ranges (groups with only the source row, no
    target rows).
  - `planFill` produces the expected `writes` array for: a 1×1
    source fill-down 10 rows (10 writes); a 3×1 source fill-down
    9 rows (9 writes, cyclic); a 1×3 source fill-right 6 columns
    (6 writes, cyclic); a 1×1 source fill-down across a read-only
    column (skipped, no write); a 1×1 source where the target
    equals the source (no writes, fill-canceled).
- **`__tests__/useGridFill.test.ts` (NEW)** — hook behavior:
  - `handleVisible` is false when readOnly, isEditing, !onWrite,
    or the source spans multiple groups.
  - `fillDown` / `fillRight` no-op + announce when the selection
    is single-row / single-column.
  - `fillDown` against a multi-group selection produces one
    semantic op containing concatenated writes from each sub-
    range; the op fires `dispatchWrite` exactly once.
  - `onHandleMouseDown` sets up document listeners; mousemove
    updates `targetPreview`; mouseup commits via `dispatchWrite`
    and tears down listeners; cancel() during a drag tears down
    without committing.
- **`__tests__/FillHandle.test.tsx` (NEW)** — component:
  - Renders at the bottom-right of its containing cell when
    `data-fill-handle="true"` is set.
  - Calls `onMouseDown` with the event and stops propagation
    (assert `event.stopPropagation` called via spy).
  - Carries `aria-label="Drag to fill"` for screen-reader users.
  - Carries `tabIndex={-1}` (not Tab-reachable — the drag is
    pointer-only; ⌘D / ⌘R are the keyboard path).
- **`__tests__/useGridKeyboard.test.ts` extensions**:
  - ⌘D dispatches `onFillDown` when provided; preventDefault is
    called; no-op when undefined.
  - ⌘R dispatches `onFillRight` when provided; preventDefault is
    called; no-op when undefined.
  - readOnly = true: both keys are inert (matching the existing
    ⌘Z / ⌘⇧Z readOnly gating).
- **`__tests__/useGridPointerDrag.test.ts` extensions**:
  - Mousedown inside a fill-handle DOM target (matched via the
    widened `isPointerInActiveEditor` guard) does NOT start a
    cell drag.
- **`__tests__/DataTable.test.tsx` extensions**:
  - Source rectangle's bottom-right `<td>` carries
    `data-fill-handle="true"` when the source is well-formed.
  - The attribute is absent when readOnly, isEditing, or the
    source spans multiple groups.
  - Drag-fill simulation (synthetic mousedown → document
    mousemove → mouseup) dispatches one `WriteOp.kind = "fill"`
    op; the inverse is `WriteOp.kind = "cell"` with previous
    values.
  - ⌘D + ⌘R wired in: keystroke simulation reaches the planner.
  - ⌘Z after a fill restores every written cell's previous value
    in one history step.
  - Group-clamp: with grouping active and a source in `group-A`,
    a drag toward `group-B` produces a target rectangle whose
    last row is the last `group-A` row; the writes never
    reference a `group-B` rowId.
- **`__tests__/GridBody.test.tsx` extensions**:
  - The fill-handle `<button>` renders inside the source's
    bottom-right `<td>` when handleVisible is true.
  - `<td data-fill-target="true">` appears on every cell inside
    `targetPreview` during a simulated drag; clears on
    mouseup.

Existing Phase 0–6 tests stay green. No tests are deleted; the
Phase 7 hook additions sit alongside the existing
`useGridPointerDrag.test.ts` and `useGridSelection.test.ts`
without changing their assertions.

## 5. Execution order

Five steps. Each leaves the tree green (`make test`, `make
typecheck`, `make lint`). Commit per step.

### Step 1 — Fill planner + group derivation helpers

- Create `tokens/pointerDragConstants.ts` exporting
  `EDGE_PX = 30`, `SCROLL_PX = 12`, `AXIS_THRESHOLD = 8`. Switch
  `useGridPointerDrag.ts` to read from this module (no behavior
  change; one-line constant rename).
- Add `planFill`, `groupPathByRowIdFromBodyPlan`,
  `clampRangeToGroup`, `splitRangeByGroup`, `chooseFillAxis`,
  and `buildFillTargetFromPointer` to `lib.ts` per §4.5–§4.9.
- Add `FillState` to `types.ts`.
- Test: `__tests__/fillPlanner.test.ts`.
- At this step, no UI changes are visible. The library can
  derive fill writes against a hand-built source / target.

### Step 2 — `useGridFill` hook (no UI)

- Create `hooks/useGridFill.ts` per §4.1 entry. Internally it
  manages: source derivation from selection, dominant-axis state
  machine, document-level listeners (factor a small private
  helper from `useGridPointerDrag`'s `startSession` /
  `teardown` pattern; do NOT share the hook itself), auto-scroll
  RAF loop, group clamping, drag-commit dispatch through
  `dispatchWrite`, fillDown / fillRight keyboard methods.
- Wire `DataTable.tsx` to compute `groupPathByRowId` from
  `bodyPlan` (one memo) and pass it into `useGridFill`.
- Do NOT mount the FillHandle yet. The hook just runs; nothing
  in the body changes visually.
- Test: `__tests__/useGridFill.test.ts`. Cover handle-visibility
  rules, fillDown / fillRight semantics including multi-group
  split, drag commit + cancel paths, group clamp announce.
- At this step, every Phase 7 acceptance criterion related to
  write semantics is covered by unit tests, but the user has no
  visual surface yet.

### Step 3 — FillHandle component + body wiring

- Create `components/FillHandle.tsx` per §4.1 entry. Pure
  presentational.
- Extend `GridBody.tsx` to accept `fill.source`,
  `fill.targetPreview`, `fill.handleVisible`,
  `fill.onHandleMouseDown` and render the handle inside the
  source rectangle's bottom-right cell. Emit
  `data-fill-target="true"` on cells inside `targetPreview`.
- Extend `DataTable.tsx`'s `isPointerInActiveEditor` callback to
  also return `true` when the target is inside the FillHandle
  (so the cell-drag hook bails when the user grabs the handle).
- Add CSS rules per §4.1.
- Test: `__tests__/FillHandle.test.tsx`,
  `__tests__/GridBody.test.tsx` extensions for the handle render
  and the `data-fill-target` attribute.
- At this step, drag-fill works end-to-end. Group clamping works.
  ⌘D / ⌘R are still inert (Step 4 wires them).

### Step 4 — ⌘D / ⌘R keyboard wiring

- Extend `useGridKeyboard.ts` to accept `onFillDown` /
  `onFillRight` and dispatch them on ⌘D / ⌘R per §4.6.
- Wire `DataTable.tsx` to pass `fill.fillDown` / `fill.fillRight`
  into `useGridKeyboard`.
- Test: `__tests__/useGridKeyboard.test.ts` extensions;
  `__tests__/DataTable.test.tsx` extension for the full keyboard
  → planner → dispatchWrite → history path.
- At this step, every Phase 7 acceptance criterion is met. Run
  the full Phase 0–6 regression test suite.

### Step 5 — Demo walk + post-walk fixes

- Run `make typecheck && make lint && make test && make
  format`. Run `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end in Chrome and Safari.
  Record pass/fail in §11.
- Commit any post-walk fixes as a final commit. Recent phases
  have needed 0–3 fixes; budget 0–2 here. Likely candidates:
  the handle's 8 px pixel position (may need offset tweak per
  browser), the cursor type during drag (Chrome and Safari
  differ slightly on `crosshair` rendering), and the dominant-
  axis threshold (8 px is a guess against the AirTable
  reference — may want 10–12 px after touching it).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The handle's absolute positioning at `right: -3px; bottom: -3px` overlaps the next cell's left border / next row's top border, creating a 1-pixel visual artifact at the seam between adjacent cells. | The handle is 6 × 6 with `z-index: 2`; the adjacent cells' borders render below it. Verified visually in Phase 3's perimeter outline (which also lives outside the cell box and composes cleanly). Step 5 demo walk validates against the live grid. |
| `useGridFill`'s document-listener setup duplicates `useGridPointerDrag`'s pattern; factoring shared infrastructure tempts an over-engineered abstraction. | Resist factoring beyond the shared constants (`pointerDragConstants.ts`). The hooks share *behavior* but not *state*; a shared "drag session" abstraction would couple them across the cell/column/fill distinction in a way that complicates each. Two ~150-LOC hooks beats one ~300-LOC abstraction. Phase 7 lifts only the three constants. |
| Mousedown on the handle bubbles to the cell, which interprets it as a range-start gesture and clobbers the selection. | `FillHandle.onMouseDown` calls `event.stopPropagation()` AND `event.preventDefault()`. The cell handler's existing `isPointerInActiveEditor` guard widens to also return true for fill-handle targets — belt + suspenders. Tested. |
| Auto-scroll during a vertical fill drag past the visible group bottom keeps scrolling but the clamp pins the target row — the user sees the viewport scroll past the group without the target rectangle following, which reads as a stuck drag. | The auto-scroll loop runs unconditionally (pointer + EDGE_PX), but the clamp pins the target rectangle. The visual result is that the target rectangle's bottom edge stays at the group's last row while the viewport continues to scroll, exposing rows in the next group with no fill preview. Acceptable — the user sees "you're past the group, fill won't follow." Announce fires once (`Fill clamped to group bottom.`). Demo step 10 validates this read. |
| The group clamp triggers on every mousemove; the announce-region message would fire continuously and spam the screen-reader user. | The hook stores a `hasAnnouncedClamp` ref initialized false on session-start; sets true on the first clamping mousemove; the announce-region call is conditional on the flag flip. Tested. |
| ⌘D on a selection that spans 3 groups produces 3 sub-fills; if any single sub-fill's writes fail (consumer rejects), the entire op should roll back. | `splitRangeByGroup` produces sub-ranges; `planFill` is called once with the *combined* writes (the function accepts a single source / target pair; the hook concatenates per-sub-range plans and builds one combined `WriteOp.kind = "fill"`). The single dispatchWrite call ensures atomicity at the history layer; consumer-side atomicity is the consumer's responsibility (matches paste). |
| `groupPathByRowIdFromBodyPlan` runs on every render that touches bodyPlan, which happens on every group-toggle. | The map is memoized in `DataTable.tsx` off `bodyPlan` identity. `bodyPlan`'s identity changes when `view.group` / `view.expandedGroups` / `rows` / `view.filter` / `view.sort` change — all of which are state the user is actively manipulating, so recomputation is cheap and well-timed. |
| The handle visibility computation reads `view.group` indirectly via `groupPathByRowId`; if Phase 6's grouping refinements (still in flux) change the group-pathKey shape, the clamp breaks. | The clamp consults only the pathKey *strings* by equality; the shape of the string (JSON-stringified value-list per §4.6 of Phase 6) is opaque. Any Phase 6 string-format change is transparent to the clamp. The only Phase 6 contract Phase 7 depends on is `bodyPlan`'s discriminated union shape (`{kind: "group" \| "data", pathKey, rowId, ...}`) — settled and tested. |
| ⌘D over a 1-row selection (no fill possible) competes with the browser's default ⌘D (bookmark). The keyboard hook's no-op path must still preventDefault, or the user gets a surprise bookmark dialog. | `useGridKeyboard`'s ⌘D handler preventDefaults *before* invoking `onFillDown` (or the no-op announce). The handler returns early if `onFillDown` is undefined entirely — that's the "fill not wired" case where the consumer presumably wants the browser default to win. With fill wired, the no-op announce path still preventDefaults. Tested. |
| ⌘R over a 1-column selection (no fill possible) competes with the browser's default ⌘R (reload). Same risk shape as ⌘D — and reload is worse than bookmark. | Same fix: preventDefault before deciding the fill is a no-op. Tested. Note for Step 5 demo: if a Safari extension intercepts ⌘R before the page handler (some dev users have such setups), the test fails harmlessly — the page reloads and the user's work is lost. Document this as a Safari-only caveat in the demo notes; consider warning users to disable conflicting extensions. |
| `planFill`'s cyclic formula uses `((delta) % cycle + cycle) % cycle` to handle negative deltas — easy to get wrong, edge case is upward fill from a multi-row source. | Phase 7 does not support upward fill in the drag (the handle is at the source's bottom-right; a user can't drag "up" past the source). The cyclic formula is robust against any input by construction; the negative-delta guard is defensive. Unit-tested in `fillPlanner.test.ts`. |
| Cross-column horizontal fill from a number column into a text column writes a number value into a text field. The consumer's `onWrite` may accept this silently (storing the number), reject it, or fail at the backend. | Phase 7 doesn't try to mediate cross-type fills — the registry's `coerceFieldValue` exists but isn't called by `planFill`. The contract is "fill writes raw values; consumer's onWrite enforces target-field schema." Rooms (Phase 7's only consumer) has no horizontal-fill-across-types scenarios. Documented as §7 "what this phase explicitly does not do." A future phase can route fill writes through the registry's coerce path if a consumer needs it. |
| Fill-handle visible on a 1×1 active cell (no explicit range) — the user might expect drag-extends-selection (Phase 3's cell-drag) rather than drag-fills. | The handle is a small (6 × 6) target at the cell's bottom-right corner; the rest of the cell starts a Phase 3 cell-drag. The 6 px target matches AirTable's affordance size exactly (Ed-supplied reference, §12 Q1). Half the handle sits outside the cell border, half inside — so the effective hit target overlaps both the cell interior and a small strip below + right of it. If users in Step 5 demo find the hit target too small on touch devices, can grow to 8 × 8 without contract changes; PH-Navigator's pointer-first user base makes 6 × 6 the right starting point. |
| Selection-after-fill (§2 constraint 12) on a multi-group ⌘D fill — should the resulting selection cover all sub-ranges (multi-region selection) or just the original selection rectangle? | Selection stays exactly where it was before ⌘D (the same range the user already had selected). PH-Navigator's selection model doesn't support multi-region selections; preserving the input range matches AirTable's ⌘D behavior. Tested. |
| `data-fill-handle="true"` attribute on `<td>` could conflict with future column-config attribute additions or CSS selectors. | The attribute is namespaced under `data-fill-` (no collision with `data-axis-tint`, `data-row-id`, `data-field-key`, `data-column-select-fieldkey`). `grep -rn "data-fill" frontend/src/` returns only Phase 7's own selectors. Safe. |
| The handle's `position: absolute; right: -4px; bottom: -4px` requires the cell to be `position: relative`; if any other Phase 0–6 CSS rule sets `position` on cells, the handle floats away from its anchor. | The `:has(.data-table-fill-handle)` selector targets exactly the source cell and sets `position: relative` defensively. No other Phase 0–6 rule sets `position` on `<td>`. Safari 15+ supports `:has` (Safari is the only browser PH-Navigator supports besides Chrome per §12 Q4 of Phase 6); the rule works there. If older Safari support is ever needed, switch to a JS-set `relative` class. |
| Fill commits write to the backend through the consumer's `onWrite`; a slow backend means the announce-region message ("N cells filled.") fires before the writes have persisted, suggesting a successful save when one is still in flight. | `dispatchWrite` awaits `onWrite` before fulfilling its promise; `useGridFill.commit()` awaits dispatchWrite before firing the announce. The announce fires only after the consumer has materialized the writes. Latency to the backend is the consumer's concern; the library's announcement is honest. |
| `splitRangeByGroup` over an ungrouped view returns one sub-range covering the whole selection; the multi-group split branch never fires. | Tested explicitly. The empty-pathKey sentinel makes ungrouped views "all one group." Correctness preserved without a separate ungrouped-fast-path branch. |
| `bodyPlan` mid-Phase-6 still allows minor shape tweaks; if Phase 6 adds a new BodyPlanItem kind (e.g. a future "subtotal" item) Phase 7's group-key walk would misclassify it. | `groupPathByRowIdFromBodyPlan` switches on `item.kind === "group"` / `"data"` — unknown kinds would be silently ignored, causing data rows to carry a stale pathKey. Phase 7 documents that any future BodyPlanItem kind must update this helper. The risk is low (Phase 6 is feature-complete for the parity scope; no new kinds planned). |

## 7. What this phase explicitly does not do

- **No pattern detection.** Excel's "Mon, Tue → fill recognizes
  weekdays" stays deferred (parent §16). Phase 7 is strictly
  cyclic repeat.
- **No multi-source non-contiguous fill.** A user with two
  separate selections (which PH-Navigator does not support
  anyway) can't fill both at once.
- **No fill upward.** The handle is at the source's bottom-
  right; dragging up past the source is a no-op (the target
  rectangle collapses to the source). Phase 7 does not add a
  top-left handle. AirTable matches.
- **No undo for selection changes after a fill.** ⌘Z reverts
  the writes but leaves the selection where the fill placed it.
  Matches Phase 4 / 5 / 6 (selection is not in the write
  reducer's history).
- **No cross-column type coercion through the registry.**
  Horizontal fill across mixed-type columns writes raw values;
  the consumer's `onWrite` enforces target-field schema. See §6
  risk + §4.8.
- **No fill from an aggregation cell.** The group-header
  aggregation cells (Phase 6 §4.7) are not selectable, do not
  carry a `data-row-id`, and don't participate in fill. The
  source rectangle can only sit on data rows.
- **No backend assist for fill.** The consumer's `onWrite`
  receives N×M cell writes in one op; backends with a bulk-
  upsert path can use it for efficiency, but Phase 7 doesn't
  prescribe one. Rooms' existing JSON-Patch flow handles bulk
  writes already.
- **No keyboard equivalent for fill-up or fill-left.** Excel's
  ⌥ + arrow extends a fill in arbitrary directions; PH-
  Navigator stays with ⌘D / ⌘R only (parent §13).
- **No persistence of fill state.** Fill is a one-shot gesture;
  there's no "fill in progress" state that survives a refresh,
  a tab switch, or a sessionKey change. The hook's state is
  fully transient.
- **No CSS animation on the handle.** Excel animates the handle
  on hover; AirTable does not; Phase 7 follows AirTable
  (static handle, cursor change to crosshair on hover).
- **No accessibility wiring for the drag.** The handle is
  pointer-only (drag); the keyboard path is ⌘D / ⌘R. A future
  phase could add an `aria-activedescendant`-driven keyboard
  drag mode for the handle, but no consumer has asked for it.
- **No undo across a project / sessionKey change.** History
  clears on sessionKey change (Phase 0 contract); a fill made
  in project A cannot be undone after switching to project B.
  Matches every other write gesture.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — fill planner + group derivation helpers | 1.5 | 2.5 |
| 2 — `useGridFill` hook (no UI)              | 2.0 | 3.0 |
| 3 — FillHandle component + body wiring      | 1.5 | 2.5 |
| 4 — ⌘D / ⌘R keyboard wiring                 | 0.5 | 1.0 |
| 5 — demo walk + post-walk fixes             | 1.0 | 1.5 |
| **Total**                                   | **6.5** | **10.5** |

Parent plan budgeted 6–10; the estimate's high end pushes 0.5
hr past, allowing for:

- Step 2's hook is the trickiest piece (dominant-axis state
  machine + document listeners + group clamp + auto-scroll +
  multi-group ⌘D split). It mirrors Phase 3 closely so the
  patterns are known, but the combination is new.
- Step 3's CSS positioning (`:has()` selector + absolute handle
  + `data-fill-target` tint) may need one round of cross-browser
  tweaking; the 0.5 hr buffer absorbs it.

The 3.0 hr high on Step 2 is the largest single allocation;
expect it to absorb any one-off issue with the multi-group ⌘D
write batching or the auto-scroll loop's interaction with the
group clamp.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–6:

1. `feat(data-table): fill planner + group derivation helpers`
2. `feat(data-table): useGridFill orchestrator hook`
3. `feat(data-table): fill handle UI + body wiring`
4. `feat(data-table): ⌘D / ⌘R keyboard shortcuts`
5. `chore(data-table): Phase 7 demo fixes` (only if post-walk
   polish is needed; otherwise omit and let Step 4 be the closer)

## 10. Demo script

After Step 4 (or Step 5 if polish landed), walk this end-to-end
against Rooms in a fresh browser session. Record pass/fail in
§11. Repeat in Safari.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in as editor, open any project with ≥10 rooms spread
   across ≥2 floor levels. Navigate to Equipment → Rooms.
3. **Handle on a single cell.** Click row 3 `name`. A small
   square handle appears at the cell's bottom-right corner.
   Click elsewhere — handle moves. Click row 3 `name` again
   to start fresh.
4. **Drag-fill down.** Click row 3 `name`, drag the handle
   down to row 12. As you drag, a tint preview rectangle
   covers rows 4–12 in the `name` column. Release. Rows
   4–12 all show row 3's name value. Announce reads `9
   cells filled.`. Selection is now rows 3–12 on `name`.
5. **Cyclic from a multi-cell source.** Select rows 3–5 on
   `name` (Shift+Click to extend). The handle moves to the
   bottom-right of row 5's `name` cell. Drag down to row 11.
   Release. Rows 6–11 show
   `[row3, row4, row5, row3, row4, row5]` cyclically.
6. **Drag-fill right.** Click row 3 `iCFA factor`. Drag the
   handle right to `num_people`. Tint preview extends across
   the columns. Release. `iCFA factor` value is copied (raw)
   into the intermediate column and `num_people` (any type
   mismatch surfaces as an announce error from the
   consumer's `onWrite`).
7. **Dominant-axis pick.** Click row 3 `name`. Begin drag,
   move pointer 30 px down + 5 px right → fill goes vertical.
   Cancel (Esc) and restart. Move 5 px down + 40 px right →
   horizontal. Confirms the axis lock.
8. **Edit-mode hides handle.** Double-click any cell to enter
   edit mode → handle disappears. Esc → handle returns.
9. **Read-only hides handle.** Switch to viewer / locked
   version → no handle on any cell. Switch back to editor
   → handle returns.
10. **⌘D fill down.** Select rows 3–10 on `floor_level`.
    Press ⌘D. Rows 4–10 take row 3's floor_level value.
    Selection stays at rows 3–10. Announce: `7 cells
    filled.`. Single-row selection: ⌘D announces `Select
    more than one row to fill down.` and does nothing.
11. **⌘R fill right.** Select row 3, columns `iCFA factor`
    → `num_people`. Press ⌘R. Columns to the right of
    `iCFA factor` take its value. Announce reports the count.
12. **Group-clamp drag.** Open `Group ▾`, add `floor_level
    asc`. Click row 3 `name` (let it be a `1st`-floor room
    where 4 rooms sit on `1st`). Drag the handle down past
    the bottom of the `1st` group toward the next group.
    The tint preview stops at the last `1st`-group row;
    releasing fills only within `1st`. Announce: `N cells
    filled. Fill clamped to group bottom.`.
13. **Group-clamp ⌘D split.** Still grouped. Select rows 3–10
    spanning two groups. Press ⌘D. The top row of each group's
    sub-range fills its own group's remaining rows. Announce
    reports the total. ⌘Z reverts every write in one step.
14. **Cross-group source hides handle.** Still grouped.
    Shift+Click selects rows 3–10 spanning two groups → the
    perimeter outline draws but the handle disappears (the
    source is cross-group). ⌘D still works (with the split);
    drag-fill is not available because the source has no
    well-defined target.
15. **Read-only column skip.** Fill a range that crosses a
    read-only column (e.g. a computed iCFA in Rooms) →
    announce: `N cells filled (M skipped, read-only).`.
16. **⌘Z reverts.** After any of the above fills, press ⌘Z →
    every written cell restores its previous value in one
    step. ⌘⇧Z re-applies.
17. **Auto-scroll past viewport.** Scroll the table so row 30
    is the active cell. Drag the handle down past the bottom
    edge of the viewport — auto-scroll fires, target follows.
    Group clamp still applies (the scrolled-into-view rows
    are re-checked against the source's group on each frame).
18. **No Phase 0/1/2/3/4/5/6 regressions.** Inline edit,
    paste (still blocked while grouped), row insert / delete,
    mouse-drag selection (drag from any non-handle area of a
    cell starts a Phase 3 cell drag, not a fill), ⌘C, ⌘Z,
    Phase 4 filter / sort popovers, Phase 5 option editor,
    Phase 6 group accordion + aggregations + 7-subset tint
    cascade all work unchanged.
19. **Type-checks / lint / tests / build.** Run `make
    typecheck && make lint && make test && pnpm run build`
    in a separate terminal — everything clean.
20. **Safari walk.** Repeat steps 4, 7, 11, 12, 16 in
    Safari. Pay attention to the `:has()` selector on the
    source cell (Safari supports it but historical bug
    reports flag occasional layout flickers) and the
    cursor-during-drag rendering (Safari renders `crosshair`
    slightly differently than Chrome — visual only).

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — fill planner + group derivation helpers     | 2026-05-24 | ✅ | 21 helper tests; pointer-drag constants promoted to shared tokens module. |
| 2 — useGridFill hook (no UI)                    | 2026-05-24 | ✅ | 14 hook tests. Hook wiring deferred to Step 3 to keep the tree green under `noUnusedLocals`. |
| 3 — FillHandle component + body wiring          | 2026-05-24 | ✅ | 4 FillHandle + 4 GridBody tests. Drag-fill works end-to-end after Step 4. |
| 4 — ⌘D / ⌘R keyboard wiring                     | 2026-05-24 | ✅ | 7 keyboard + 5 end-to-end tests. Full suite 380 → 392 green. |
| 5 — demo walk + post-walk fixes                 | 2026-05-24 | ✅ | Four post-walk patches landed in `294f848` (see notes below). |
| Phase 7 overall                                 | 2026-05-24 | ✅ | All sixteen acceptance criteria verified on Chrome against Rooms. |

**Post-walk fixes (Step 5, all in `294f848 Refactor topbar, grid-fill guard, CSS & tests`):**

1. **Handle rendered as a vertical line instead of a 6×6 square.** Global
   `button { min-height: 38px; padding: 8px 14px; border: 1px solid
   transparent }` rule in `App.css` was stretching the handle to
   `~6×38 px`. Fix: `.data-table-fill-handle` rule explicitly resets
   `min-height: 0`, `min-width: 0`, `border: 0`, `border-radius: 0`,
   `padding: 0`, plus `box-sizing: border-box` so the 6×6 is literal.
2. **Plan §2 constraint 1 was wrong: "library-only" didn't account for
   the consumer needing to materialize `kind: "fill"` writes.**
   `EquipmentTab.handleTableWrite` only branched on `cell` / `paste`,
   so fill ops fell through and writes were never persisted. Fix:
   one-line widen to `cell | paste | fill` (fill shape is `CellWrite[]`
   like `cell`, no option-list delta). Constraint 1 should be re-read
   as "library + a one-line consumer route to the same payload path
   the `cell` op already uses." Recorded as a plan delta to apply to
   the catalog-page migration spec.
3. **mouseup + pointerup both firing → two mutations per drag → stale
   draft conflict banner.** `useGridFill` mirrored `useGridPointerDrag`'s
   pattern of listening to both events, but the pointer-drag hook's
   `handleMouseUp` is idempotent (just `teardown()`); the fill hook's
   commit path dispatches a mutation each time, so the second event
   fired a duplicate mutation with the now-stale draft etag. Fix: a
   one-shot `committed` flag in the session closure guards the commit
   call (Phase 7 §6 risks should add this — the `useGridPointerDrag`
   pattern is NOT safely transferable to hooks whose teardown is not
   idempotent).
4. **"Unsaved Rooms draft restored" banner fired after every in-session
   edit (pre-existing UX bug, surfaced during the walk).** Banner at
   `EquipmentTab.tsx:335` gated only on `roomsSlice.source === "draft"`,
   which is true after any edit — not just on cross-session restore.
   Fix: gate the banner on `!wasLocalDraftTouched(project.id,
   activeVersionId, roomsSlice.draft_etag)` (the pattern already used
   by `VersionControls.tsx:122`). Banner now correctly distinguishes
   "draft from a prior session/tab we recovered" from "draft this tab
   just produced." Not a Phase 7 regression — pre-existing since the
   draft-touch tracking was introduced — but fixed inline because the
   walk made it obvious.

## 12. Open questions — resolved 2026-05-24

Ed walked the ten open questions on 2026-05-24. Resolutions
below; the §4.1 CSS rule and §6 risk note update inline to
match the AirTable visual the walk pinned down.

1. **Handle size + shape.** RESOLVED. **Match AirTable.**
   Reference: Ed-supplied screenshot of an active single-
   select cell ("Oven" → "Yes" cell in a TYPE-grouped table;
   in-context only — the cited on-disk path
   `/Users/em/Desktop/Screenshot 2026-05-24 at 10.31.07 AM.png`
   did not persist; the visual specs derived from it are
   captured here so the implementation doesn't need the file).
   The screenshot shows: small solid filled square at the
   active cell's bottom-right corner, ~6 px on a side, no
   border, no rounding visible at that size, sitting centered
   on the corner so half overlaps the cell interior and half
   overlaps the outside seam. §4.1 CSS rule updates to
   `width: 6px; height: 6px; right: -3px; bottom: -3px;
   border: 0; padding: 0; z-index: 2`.

2. **Handle color.** RESOLVED. **Match AirTable.** From the
   same screenshot: the handle is the **same blue as the
   active-cell perimeter outline** — a fully-saturated,
   slightly-darker-than-the-tint blue that reads as "the
   outline's corner is a knob you can grab." §4.1 CSS rule
   uses `background: var(--accent-text)` (the token Phase 3
   `.data-table-cell-active` uses for `outline: 2px solid
   var(--accent-text)`). The handle and the outline share
   the same blue, exactly as the AirTable reference shows.
   No new token introduced.

3. **Axis-threshold value.** RESOLVED. **8 px.** Matches the
   draft default; reads as deliberate without feeling sluggish.

4. **Cursor during drag.** RESOLVED. **`crosshair`.** Matches
   the draft recommendation; no custom asset needed.

5. **Multi-group ⌘D announce wording.** RESOLVED. **Simple
   wording — `N cells filled.`** (no group-count phrasing).
   The grid renders the result; the announce is for screen-
   reader users who already know they triggered ⌘D.

6. **Selection-after-fill on multi-group ⌘D.** RESOLVED.
   **Stay on the original selection rectangle.** The user
   chose that rectangle; preserving it lets them re-fire ⌘D
   without re-selecting. Matches the draft recommendation.

7. **Announce wording for the clamp event.** RESOLVED. **Keep
   the announce.** `Fill clamped to group bottom.` fires once
   per session. The clamp is an invisible constraint to a
   screen-reader user; the announce surfaces it.

8. **Cross-browser verification gating.** RESOLVED. **Chrome
   + Safari only; no Firefox.** Matches Phases 3 / 4 / 5 / 6.

9. **Fill across a hidden column.** RESOLVED. **Visible-only**
   (planner walks `visibleColumnDefs`, hidden columns are
   invisible to fill — same as paste).

10. **Single-cell handle visibility on an empty grid.**
    RESOLVED. **Keep the guard.** `visibleDataRows.length ===
    0` → no handle. Selecting a cell to fill is moot when
    there are no cells.

Additional surface detail captured from the walked screenshot
that doesn't fit a clean Q/A:

- The screenshot also shows AirTable's **cell-expansion icon**
  (`↗`) at the top-right of the active cell, separate from
  the fill handle. That icon is a different feature (open
  the row's side-panel detail view) and **not part of Phase
  7's scope** — PH-Navigator's side-panel work is deferred
  to the catalog-migration plan per parent §14. Phase 7
  ships only the bottom-right handle.

## 13. Parent-plan delta

This Phase 7 plan implements parent §13 with one material
divergence worth recording on the parent-plan status table:

- **Parent §13 "Disabled while grouped (banner 'Ungroup to
  fill')"** is REPLACED by **"Clamped to the active row's
  group; handle hides when the source spans multiple
  groups"** per Ed 2026-05-24. The new rule keeps fill
  available inside the accordion (a heavy-traffic flow:
  setting all rooms on a floor to the same iCFA factor),
  matching the principle that "view shape should not
  suppress data writes when the write semantics can be
  resolved deterministically." Paste stays blocked because
  its source is external (clipboard) and can't be reasoned
  about against group boundaries; fill's source is in-table
  and trivially can.

- **Parent §13 "Fill drag reuses the selection controller
  pattern (L7.1)"** is realized by `useGridFill` running as
  a sibling to `useGridPointerDrag` (not a co-mode inside
  it). The two hooks share the three constants
  (`EDGE_PX`, `SCROLL_PX`, `AXIS_THRESHOLD`) via the new
  `tokens/pointerDragConstants.ts` module but otherwise
  stay independent. The factoring choice is recorded in §6
  risks ("two ~150-LOC hooks beats one ~300-LOC
  abstraction").

- **Parent §13 "`⌘D fill down`, `⌘R fill right` keyboard
  equivalents — same write path"** is implemented per §4.6
  with the additional group-aware split rule for ⌘D:
  multi-group selections split into per-group sub-ranges,
  each filled from its own top row, all under one
  `WriteOp.kind = "fill"`. The parent plan didn't enumerate
  this split rule; Phase 7 derives it from the group-clamp
  invariant (fill writes never cross a group boundary, full
  stop).

Status table update (post-Step 4 sign-off): the parent
plan's §18 should add a row for Phase 7 with the sign-off
date and a one-line note matching Phases 1–6's style.
Suggested entry:

> | 7 | YYYY-MM-DD | ✅ YYYY-MM-DD | All N steps landed; M
> tests passing; fill handle + ⌘D / ⌘R + group clamp shipped
> against the data-table library with zero consumer changes.
> Parent §13 default "disabled while grouped" replaced by
> "clamped to active row's group" per Ed 2026-05-24. AirTable
> parity gate fully closed; catalog migration unblocked. |

After Phase 7 lands, parent plan §3 sequencing rule 5 (one
write primitive) covers every Phase 0–7 gesture: cell, paste,
fill, rowInsert, rowDelete, fieldDefMutation all flow through
the same `dispatchWrite` chokepoint. Rule 4 (in-memory undo)
holds for every data-write gesture; view-state mutations
(filter / sort / group / aggregations / expandedGroups) stay
intentionally non-undoable. The library is feature-complete
for the AirTable parity scope; the catalog-page migration
(parent §14) can start against a primitive that has no
parity-bar behavior left to add.
