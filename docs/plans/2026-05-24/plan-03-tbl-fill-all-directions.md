---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Third in the 9-plan AirTable-parity polish series.
        Sequenced 3/9 (extends existing tested code symmetrically).
SCOPE: Extend the fill primitive (shipped in Phase 7,
       `docs/plans/2026-05-24/phase-7-fill-handle.md`) to support
       fill-left and fill-up in addition to today's fill-right and
       fill-down. Both pointer-drag and keyboard paths gain the new
       directions. Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-FILL-1)
PRECEDING-PHASE: docs/plans/2026-05-24/phase-7-fill-handle.md
RELATED:
  - frontend/src/shared/ui/data-table/hooks/useGridFill.ts
    (the orchestrator; 513 LOC)
  - frontend/src/shared/ui/data-table/lib.ts
    (`planFill`, `chooseFillAxis`, `buildFillTargetFromPointer`,
    `clampRangeToGroup`, `splitRangeByGroup`)
  - frontend/src/shared/ui/data-table/hooks/useGridKeyboard.ts
    (⌘D / ⌘R wiring; new shortcuts added by this plan)
  - frontend/src/shared/ui/data-table/components/FillHandle.tsx
---

# Plan 03 — Fill propagation in all four directions

## 1. Why this plan exists

Phase 7 (2026-05-24) shipped fill in two directions: down (drag the
handle south, or ⌘D) and right (drag east, or ⌘R). The plan
explicitly excluded upward fill ("no fill upward… AirTable matches")
based on the assumption that AirTable has no reverse-direction fill.

Ed's 2026-05-24 review revises that: Excel-style four-direction
fill is the expected behavior; AirTable's web app actually does
support drag in any cardinal direction from the active handle (it
just only renders the handle at the bottom-right corner; the drag
direction is what determines the fill direction). The user is
asking for all four directions.

The Phase 7 implementation is structurally ready for this — the
helpers (`planFill`, `clampRangeToGroup`, etc.) operate on
normalized rectangles and don't bake in a direction. Two adjustments
make the symmetry land:

1. **`buildFillTargetFromPointer`** must extend the source's
   *opposite* edge to the pointer cell when the pointer is upward
   or leftward (it currently only extends down/right).
2. **`useGridFill.commit()`** must handle the case where the target
   rectangle is *above* / *left of* the source — the source's
   cyclic anchor moves to the bottom / right row instead of top /
   left.
3. **Two new keyboard shortcuts** for fill-up (⌘⇧D) and fill-left
   (⌘⇧R) — see §2 constraint 4 for the binding choice.

The fill handle itself stays at the source's bottom-right corner —
that's the AirTable parity. The handle is just a grab affordance;
the drag direction tells fill what to do.

## 2. Binding constraints

1. **Library-only.** Changes in `useGridFill.ts`, `lib.ts`,
   `useGridKeyboard.ts`, and tests. Zero consumer touches.
2. **One semantic history entry per fill.** Same invariant Phase 7
   established — fill-up and fill-left land as one `WriteOp.kind =
   "fill"` op, reversible with one ⌘Z. (Phase 7's reducer is
   direction-agnostic; no change needed there.)
3. **Group clamp applies to vertical axis regardless of direction.**
   An upward fill from a row in `group-1st` toward `group-Basement`
   clamps to the source row's group (stops at the top of `group-1st`).
   Horizontal axis (fill-left / fill-right) stays group-free.
4. **Keyboard bindings: ⌘⇧D = fill up, ⌘⇧R = fill left.** Confirms
   the Q-FILL-1 recommendation from the parent story. Rationale:
   they're the obvious shift-variant of the existing pair; no
   browser default they clobber matters (⌘⇧D = nothing on macOS /
   Linux web; ⌘⇧R = hard-reload on Chrome/Safari — see §6 risks).
5. **Cyclic semantics symmetric.** Filling 5 rows upward from a
   3-row source still cycles `[source3, source2, source1, source3,
   source2]` (or however the formula works out — the cyclic source
   coordinate is computed from the target row's distance from the
   *nearest* source edge, not always the top).
6. **Selection-after-fill** sticks to AirTable behavior: selection
   becomes the union of source + target rectangle, with the active
   cell at the original source's top-left. Upward / leftward fill
   does not move the active cell.
7. **`AXIS_THRESHOLD = 8 px`** continues to apply identically — the
   axis lock decides vertical vs. horizontal, then a sub-decision
   (positive vs. negative within the chosen axis) determines
   direction. Sub-decision is the sign of `(pointerCurrent -
   pointerStart)`.

## 3. Acceptance criteria

1. **Drag-up from a single source cell.** Click row 10 `name`,
   drag the handle upward to row 3. Rows 9 → 3 receive the row-10
   value. Announce: `8 cells filled.`. Selection becomes rows 3–10.
2. **Drag-left from a single source cell.** Click row 5
   `num_people`, drag the handle leftward to `icfa_factor`. The
   columns between receive the row-5 `num_people` value. Selection
   becomes the column range.
3. **Drag-up cyclic from a multi-row source.** Select rows 8–10 on
   `name` (3 source rows). Drag the handle up to row 3. Rows 3–7
   receive `[name10, name9, name8, name10, name9]` (cycled).
4. **Drag-left cyclic from a multi-column source.** Select row 5
   columns `iCFA factor` → `num_people` (3 columns). Drag left to
   `floor_level`. Receiving columns receive cycled values.
5. **⌘⇧D fills up within selection.** Select rows 3–10. Press ⌘⇧D.
   Rows 3–9 receive row-10's value (last row is the source;
   selection unchanged). Single-row selection: announce `Select
   more than one row to fill up.`.
6. **⌘⇧R fills left within selection.** Select row 5 columns
   `num_people` ← `icfa_factor`. Press ⌘⇧R. Columns to the left of
   `num_people` receive its value (rightmost column is the source).
7. **Diagonal drag still locks to dominant axis.** Drag down-left
   30 px down + 5 px left → vertical (downward) fill. Drag 5 px
   down + 40 px left → horizontal (leftward) fill.
8. **Group clamp on upward drag.** Group by `floor_level`. Click
   the last row of `group-1st`, drag handle up past the top of
   `group-1st` toward `group-Basement`. Target clamps to the top
   of `group-1st`. Announce: `Fill clamped to group top.`.
9. **⌘⇧D + multi-group selection split.** Select rows spanning
   `group-1st` and `group-2nd`. Press ⌘⇧D. Each group fills from
   its own bottom row upward. One semantic op; ⌘Z reverts both.
10. **Read-only cells skipped** identically in all four directions
    (no regression vs. Phase 7).
11. **⌘Z reverts an upward / leftward fill** in one step. ⌘⇧Z
    reapplies.
12. **No Phase 7 regressions.** All existing fill-down / fill-right
    behavior identical. Group clamp on downward drag still works.
    Handle still hides on cross-group source. ⌘D / ⌘R unchanged.

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  hooks/
    useGridFill.ts           extended:
                             - commit path: support negative
                               dy/dx target rectangles (target.row
                               above source.row, or target.col left
                               of source.col).
                             - new methods `fillUp()` and
                               `fillLeft()` (parallel to
                               `fillDown` / `fillRight`).
                             - group clamp announce wording becomes
                               directional: `Fill clamped to group
                               bottom.` vs `Fill clamped to group
                               top.` based on the clamp side.
    useGridKeyboard.ts       extended: add `onFillUp` /
                             `onFillLeft` optional callbacks; wire
                             to ⌘⇧D / ⌘⇧R per §2 constraint 4.
                             PreventDefault before dispatch (matches
                             Phase 7 ⌘D / ⌘R rule, especially
                             critical for ⌘⇧R because Chrome /
                             Safari default is hard-reload).
  lib.ts                     extended:
                             - `buildFillTargetFromPointer` accepts
                               a direction (`"down" | "up" | "right"
                               | "left"`) and builds the rectangle
                               from the source's opposite edge.
                             - `chooseFillDirection({pointerStart,
                                pointerCurrent, axis})` →
                                `"down" | "up" | "right" | "left"`.
                                Splits the locked axis into its
                                cardinal direction by sign of the
                                pointer delta.
                             - `clampRangeToGroup` extends to clamp
                                upward (currently clamps only
                                downward from the source row).
                             - `planFill` cyclic formula extends to
                                handle target rectangles where
                                `target.rowStart < source.rowStart`
                                or `target.colStart <
                                source.colStart`. The cyclic source
                                coordinate is computed from
                                distance to the *source*, not
                                always from `source.rowStart`.
  __tests__/                 extended in `fillPlanner.test.ts`,
                             `useGridFill.test.ts`,
                             `useGridKeyboard.test.ts`,
                             `DataTable.test.tsx`. New cases
                             mirror Phase 7's existing down/right
                             cases with up/left equivalents.
```

### 4.2 Cyclic formula in four directions

Phase 7's formula for downward fill:

```ts
const sr = source.rowStart + ((r - source.rowStart) % cycleRows + cycleRows) % cycleRows;
```

For upward fill (target above source), the cyclic anchor is the
source's bottom row, and the delta is negative. The modulo guard
already handles negatives, but the formula reads more cleanly as:

```ts
// Distance from the nearest source edge.
const delta =
  r > source.rowEnd ? r - source.rowStart :
  r < source.rowStart ? source.rowStart - r :
  0; // inside source — skipped earlier
// Cyclic source coordinate.
const sr = source.rowStart + ((delta % cycleRows) + cycleRows) % cycleRows;
// For upward fill, mirror the source so the row immediately above
// source.rowStart picks source.rowEnd, not source.rowStart.
const cyclicRow =
  r < source.rowStart
    ? source.rowEnd - ((source.rowStart - r - 1) % cycleRows)
    : sr;
```

That second branch is the only addition. Same shape for columns
with `colStart` / `colEnd`.

### 4.3 Group clamp in both vertical directions

`clampRangeToGroup` currently extends `rowEnd` upward (clamping
downward fills). Add a symmetric clamp for `rowStart` (clamping
upward fills):

```ts
// Sketch — actual change to clampRangeToGroup in lib.ts
if (target.rowStart < source.rowStart) {
  // Upward fill: clamp the top edge to the first row that leaves
  // the source's group.
  let { rowStart } = target;
  while (rowStart < source.rowStart) {
    const id = rowIds[rowStart];
    if (!id || (groupPathByRowId.get(id) ?? "") !== sourceGroup) {
      rowStart += 1;
      wasClamped = true;
    } else {
      break;
    }
  }
  target = { ...target, rowStart };
}
// Existing downward clamp stays.
```

Phase 7's `splitRangeByGroup` already returns per-group sub-ranges
in order; for ⌘⇧D, the hook walks the same sub-ranges but treats
each group's *bottom* row as the source and rows above as targets.

### 4.4 Direction-aware announce wording

Phase 7 fires `Fill clamped to group bottom.` once per session.
Extend:

- Downward fill clamped: `Fill clamped to group bottom.`
- Upward fill clamped: `Fill clamped to group top.`

The `hasAnnouncedClamp` ref stays one-shot per session regardless
of direction.

### 4.5 Test plan

Extend the existing Phase 7 test files (don't create new ones):

- **`fillPlanner.test.ts`** (extensions):
  - `buildFillTargetFromPointer` with `direction: "up"` extends
    source's top edge upward to the pointer row.
  - `clampRangeToGroup` with upward target clamps the top edge to
    the first out-of-group row; reports `wasClamped`.
  - `planFill` with target above source (`rowStart < source.rowStart`)
    cycles the source values mirrored as in §4.2.
  - Same for leftward target.
- **`useGridFill.test.ts`** (extensions):
  - `fillUp` no-ops + announces on single-row selection.
  - `fillLeft` no-ops + announces on single-column selection.
  - `fillUp` against a multi-group selection produces per-group
    sub-fills under one op.
  - Drag with negative dy commits an upward fill.
  - Drag with negative dx commits a leftward fill.
- **`useGridKeyboard.test.ts`** (extensions):
  - ⌘⇧D dispatches `onFillUp`; preventDefault called; no-op when
    undefined.
  - ⌘⇧R dispatches `onFillLeft`; preventDefault called; no-op when
    undefined.
- **`DataTable.test.tsx`** (extensions):
  - Drag-up + drag-left simulation end-to-end through
    `dispatchWrite` produces correct writes.
  - Group-clamped upward drag stops at the group's top.

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Planner symmetry

- Extend `buildFillTargetFromPointer` to accept a `direction`
  argument and build the rectangle from the source's opposite edge.
- Add `chooseFillDirection({pointerStart, pointerCurrent, axis})`
  returning the cardinal direction once the axis has locked.
- Extend `clampRangeToGroup` for the upward-target case.
- Extend `planFill`'s cyclic formula per §4.2.
- Tests: extend `fillPlanner.test.ts`.
- Commit: `feat(data-table): fill planner supports up + left
  directions`.

### Step 2 — Hook + drag commit symmetry

- Extend `useGridFill.ts`:
  - Drag mousemove resolves direction (not just axis), updates
    `targetPreview` accordingly.
  - Commit dispatches the correct cyclic plan for any of the four
    directions.
  - Add public methods `fillUp()` / `fillLeft()` parallel to
    existing `fillDown()` / `fillRight()`.
  - Direction-aware clamp announce wording.
- Tests: extend `useGridFill.test.ts`.
- Commit: `feat(data-table): useGridFill commits in all four
  directions`.

### Step 3 — Keyboard wiring + demo

- Extend `useGridKeyboard.ts` to accept `onFillUp` / `onFillLeft`
  and dispatch on ⌘⇧D / ⌘⇧R.
- Wire `DataTable.tsx` to pass the new methods into
  `useGridKeyboard`.
- Tests: extend `useGridKeyboard.test.ts`, `DataTable.test.tsx`.
- `make typecheck && make lint && make test`.
- `make dev`, walk §10.
- Commit: `feat(data-table): ⌘⇧D / ⌘⇧R fill-up / fill-left
  keyboard shortcuts`.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| ⌘⇧R is the browser's hard-reload shortcut in Chrome / Safari. If the page handler doesn't preventDefault before the browser handles it, the user reloads (losing in-flight draft state). | `useGridKeyboard`'s handler calls `event.preventDefault()` immediately on `event.key === "R" && shiftKey && metaKey`, *before* invoking `onFillLeft` or deciding it's a no-op. Phase 7 established this same pattern for ⌘R; this plan extends it to ⌘⇧R. Test pins the preventDefault assertion. |
| Browser extensions (e.g. dev-only "Hard Reload" macros) may intercept ⌘⇧R before the page handler. | Same caveat Phase 7 noted for ⌘R. Document in §7 ("explicitly does not do — guarantee against extensions that pre-intercept keys"). Suggest disabling conflicting extensions when using the app. |
| The cyclic formula for upward fill is easy to get wrong (off-by-one between source.rowStart and source.rowEnd). | Unit tests in `fillPlanner.test.ts` pin both directions with worked examples; the mirror-around-source-end formula is explicit and commented. |
| `chooseFillDirection` could flip mid-drag if the user reverses pointer direction past the source edge. | Phase 7's axis-lock-once-decided rule extends: the *axis* locks at threshold, the *direction* within that axis can flip during the drag (mirroring AirTable's behavior — drag down past source then back up shrinks the fill). Documented in §7. |
| `clampRangeToGroup` now has two clamp branches (downward + upward); they could conflict if both fire on a target rectangle that brackets the source. | A target rectangle always extends on one side of source only (per `buildFillTargetFromPointer`'s contract — extends opposite edge to pointer); never both. Asserted in `fillPlanner.test.ts`. |
| Multi-group ⌘⇧D requires `splitRangeByGroup` to identify each group's bottom row as source (vs. top for ⌘D). | Add a `direction` arg to the hook's per-sub-range source picker; `splitRangeByGroup` itself stays direction-agnostic. |

## 7. What this plan explicitly does not do

- Does not add diagonal fill (Excel has it as a series detection;
  AirTable does not).
- Does not add a top-left fill handle. The handle stays at
  bottom-right; only the drag direction matters.
- Does not change Phase 7's group clamp invariants — only extends
  them symmetrically.
- Does not change selection-after-fill semantics other than to
  ensure the union rectangle now extends in any direction.
- Does not guarantee against browser extensions that pre-intercept
  ⌘⇧R before the page handler runs.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — planner symmetry                 | 1.0 | 1.5 |
| 2 — hook + drag commit symmetry      | 1.0 | 1.5 |
| 3 — keyboard wiring + demo           | 0.5 | 1.0 |
| **Total**                            | **2.5** | **4.0** |

About half a workday. Most of the risk lives in Step 1's cyclic
formula; the rest is mechanical extension.

## 9. Commit plan

1. `feat(data-table): fill planner supports up + left directions`
2. `feat(data-table): useGridFill commits in all four directions`
3. `feat(data-table): ⌘⇧D / ⌘⇧R fill-up / fill-left keyboard
   shortcuts`

## 10. Demo script

1. `make dev`, open Rooms with ≥10 rooms across ≥2 floor levels.
2. **Drag-up.** Click row 10 `name`, drag handle up to row 3.
   Verify rows 9 → 3 receive row-10 value.
3. **Drag-left.** Click row 5 `num_people`, drag handle left to
   `icfa_factor`. Verify columns receive value.
4. **⌘⇧D.** Select rows 3–10, press ⌘⇧D. Rows 3–9 take row-10's
   value.
5. **⌘⇧R.** Select row 5, columns icfa_factor → num_people, press
   ⌘⇧R. Columns to left of num_people take its value.
6. **Group clamp upward.** Add Group by floor_level. Click last
   row of `1st` group, drag up past `1st` top. Verify clamp +
   announce.
7. **Multi-group ⌘⇧D.** Select rows spanning 2 groups, press ⌘⇧D.
   Verify each group fills from its own bottom upward.
8. **⌘Z.** Verify any of the above reverts in one step.
9. **Phase 7 regression check.** Drag down, drag right, ⌘D, ⌘R
   all still work identically.
10. **Chrome + Safari** — repeat steps 2, 3, 5 in both.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — planner symmetry                 | | | |
| 2 — hook + drag commit symmetry      | | | |
| 3 — keyboard wiring + demo           | | | |
| Plan 03 overall                      | | | |
