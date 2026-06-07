---
DATE: 2026-06-07
TIME: (compiled)
STATUS: **Partial** (2026-06-07). Latent-bug fixes shipped
        (popUndoEntry contract, FramePicker manufacturer-filter
        silent-drop, RefreshDialog seed deps, canvas mirror memo,
        pick-paste ternary, EdgeAddButtons dead-code removal).
        Larger refactor steps (test fixtures, container
        decomposition, ALL_SIDES / ViewDirection consolidation,
        catalog-totals hoist) and the coverage backfill deferred —
        mechanical cleanup, not correctness work. See
        `../STATUS.md` close-out notes for the full split.
AUTHOR: Claude
SCOPE: Frontend-only hygiene pass over the Aperture-Builder.
       Memoise the interior-mirroring computation, share canvas
       pixel dimensions, extract test fixtures, decompose
       `ApertureCanvasContainer`, fix the latent
       Zustand `popUndoEntry` contract issue, consolidate
       duplicated constants, eliminate the picker manufacturer-
       filter bug that silently drops the current-value chip,
       harden `RefreshDialog`'s seed effect, and backfill the
       coverage holes the review surfaced.
RELATED:
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
    (Frontend §1–§15)
  - planning/archive/apertures-cleanup/PRD.md
  - frontend/CODING_STANDARDS.md (via context/CODING_STANDARDS.md)
---

# Phase C-04 — Frontend hygiene pass

## P0. Why this phase

The frontend `apertures/` feature folder shipped through 13
phases of the build-out. Each phase prioritised correctness and
demo-ready behavior. The review surfaced three patterns the
cleanup pass should fix:

1. **Coordinate duplication.** The same logical computation runs
   in two or three places that must stay synchronised by hand:
   - `mirrorApertureForInterior` runs in three siblings under
     `ApertureCanvasContainer`, one of them without
     `useMemo`. The container itself passes `rendered` to the
     horizontal strip but the raw `aperture` to the canvas and
     overlay — an asymmetry that is currently load-bearing but
     undocumented.
   - `pxW` / `pxH` is computed independently in the container
     (used to size the stage `<div>`) and in the overlay (used
     to size the absolutely-positioned hit layer). If a future
     zoom change misses one site, the hit layer silently
     misaligns.
   - `SIDES = ["top", "right", "bottom", "left"]` exists three
     times (`lib/inUseManufacturers.ts`, `lib/refsAggregation.ts`,
     `components/ApertureElementCard.tsx`).
   - `ViewDirection` is declared in `operation-symbols.ts` and
     `frame-label-map.ts`; `ApertureSvgCanvas` exports a third
     name for the same union.
   - Five test files redefine `frame()` / `glazing()` /
     `element()` / `entry()` builders. `FrameRef` is 17 fields.

2. **Latent contract issues.** Currently-working code that
   depends on undocumented invariants:
   - `popUndoEntry` in `store/builder-store.ts` reads a `let
     popped` closure variable mutated inside `set()`. Works under
     synchronous Zustand; breaks under React 18 concurrent
     batching. Lost undo, no error.
   - `RefreshDialog`'s seed `useEffect` lists only `seedKey` and
     reads `entry.deltas` outside the deps with an
     `eslint-disable`. The drift query has `staleTime: 0` — a
     refetch while the dialog is open silently leaves stale rows.
   - `FramePicker` / `GlazingPicker` apply the manufacturer filter
     to the "all rows" lookup that is supposed to surface
     `selectedRow` even when filtered out. If the currently-
     assigned frame's manufacturer is filtered, the picker
     silently drops the current-value chip.

3. **One real-component refactor.** `ApertureCanvasContainer.tsx`
   at 432 lines conflates zoom + view-direction state, delete-
   confirmation orchestration, and pick-paste delegation. Two
   small hook extractions land it under 350 LOC of clean
   prop-wiring with no behavior change.

A pile of small wins round out the phase: collapsing
`exportContext` / `filtersContext` / `refsContext` indirections
in `AperturesTab.tsx`, memoising `ProjectRefsView` aggregations,
removing the dead branch in `pick-paste-machine.ts`,
eliminating the leaky `String.replace` in `UValueChip.tsx`,
adding WHY comments at six specific sites, deleting
`EdgeAddButtons.tsx` if confirmed dead, and closing the test
holes the review identified.

This phase is UI-only and has the smallest blast radius of the
three cleanup phases. It can ship in parallel with Phase C-02
if branch management permits (no file overlap with the backend
handler consolidation).

## P1. Acceptance — Phase C-04 done when

1. **Canvas mirror centralised.** `ApertureCanvasContainer`
   computes `rendered = useMemo(() => mirrorApertureForInterior(
   aperture, viewDirection), [aperture, viewDirection])` once.
   `ApertureSvgCanvas`, `ApertureCanvasOverlay`, and
   `HorizontalDimensionStrip` all accept `displayedAperture` (the
   mirrored entry). Neither leaf component re-mirrors.
2. **`pxW` / `pxH` passed as props.** Container is the single
   source of truth; overlay receives them.
3. **Test fixtures consolidated.**
   `__tests__/test-fixtures.ts` exports
   `makeFrameRef(overrides?)`, `makeGlazingRef(overrides?)`,
   `makeElement(overrides?)`, `makeEntry(overrides?)`. Five test
   files updated to import and use them. No test asserts a value
   that depended on a fixture quirk.
4. **`ApertureCanvasContainer` decomposed.** Two new hooks under
   `hooks/`:
   - `useCanvasViewState(aperture, scrollRef)` — owns zoom +
     fit + view-direction state and the auto-fit effect (~25
     LOC out of the container).
   - `useDeleteDimensionOrchestrator(aperture, onDeleteRow,
     onDeleteColumn)` — owns `pendingDelete` state, impact
     computation, dialog wiring (~30 LOC out of the container).
   Container drops from ~432 to ~350 LOC. Existing container
   tests pass unchanged.
5. **`popUndoEntry` contract fixed.**
   `store/builder-store.ts:popUndoEntry` reads via
   `get()` then writes via `set()`. No closure-mutation pattern.
   New `builder-store.test.ts` cases pin push/pop round-trip,
   trim at `PASTE_UNDO_STACK_LIMIT`, `clearAllUndoStacks` side
   effects, and `pickPasteAction` mode transitions that also
   touch `pickedAssignment`.
6. **`RefreshDialog` seed effect hardened.** The
   `eslint-disable` goes away; the effect either includes
   `entry` in deps (accepting the harmless idempotent re-seed)
   or hashes `entry.deltas` into `seedKey`. New test confirms a
   delta-set change while the dialog is open updates the visible
   rows.
7. **Picker "all rows" lookup unfiltered.**
   `FramePicker` and `GlazingPicker` pass no `manufacturers`
   arg for the "all rows" query used for `selectedRow` lookup.
   New test in each picker confirms the current-value chip
   renders when the assigned manufacturer is filtered out.
8. **`SIDES` / `ALL_SIDES` unified.** A single
   `lib/aperture-constants.ts` exports `ALL_SIDES: readonly ApertureSide[]`.
   Three call sites import it. No module-level re-declaration
   remains.
9. **`ViewDirection` unified.** Declared once in `types.ts`,
   re-exported from `operation-symbols.ts` and
   `frame-label-map.ts` for back-compat (one PR's worth of
   consumer updates). `ApertureSvgCanvas`'s
   `ApertureViewDirection` alias deleted.
10. **Drift-report query key + invalidation.** Frontend half of
    Phase C-03 §8 ships here if C-03 is not in flight; otherwise
    deferred to C-03. Tracked as a single owner.
11. **Catalog-totals hoist.** `FramePicker` /
    `GlazingPicker` no longer fire a second `useFrameCatalog` /
    `useGlazingCatalog` for the "total rows" count. The total
    is computed once at a parent (`ApertureElementCardStack` or
    a `CatalogTotalsContext`) and passed down. Card-stack mount
    network traffic drops measurably (one query per catalog kind
    per aperture, not per element × side).
12. **Small wins applied** (each is a single small commit):
    - `pick-paste-machine.ts:28` ternary collapsed
    - `ApertureCanvasContainer.tsx:104` inline import-type folded
    - `OperationRow.tsx:51-59` WHY comment added
    - `ApertureHitTarget.tsx:30-31` coordinate-system comment
    - `aperture-geometry.ts` header note on absolute coordinates
    - `merge_split._refresh_origin` invariant note (covered in
      Phase C-02; not duplicated here)
    - `usePickPasteHandlers.undoLastPaste` self-paste comment
    - `ManufacturerFiltersModal.arraysEqual` set-semantics note
    - `UValueChip.tsx` uses new `formatUValueNumeric()` helper
    - `AperturesTab.tsx:147-165` indirection collapsed
    - `RefreshDialog.tsx:212-216` dead `typeof "number"` branch
      removed
    - `LAST_ROW_REASON` / `LAST_COLUMN_REASON` moved into
      `canvas-constants.ts`
    - `noDeleteTooltipShown` reset in the container test's
      `beforeEach` (or moved to component state)
    - `EdgeAddButtons.tsx` deleted if `grep -rn EdgeAddButtons
      frontend/src` returns no other consumers
13. **Coverage backfilled.** New tests:
    - `__tests__/VerticalDimensionStrip.test.tsx`
    - `__tests__/TotalDimensionsCaption.test.tsx`
    - `__tests__/useApertureDimFormat.test.ts`
    - `__tests__/usePickPasteHandlers.test.ts`
    - `__tests__/builder-store.test.ts` undo + pick-paste cases
14. **`make ci` green.** No visual regressions in the canvas;
    confirm via the Playwright MCP smoke flow (open a project,
    select an aperture, switch view direction, hover the canvas).

## P2. Files touched

### New files

- `frontend/src/features/apertures/__tests__/test-fixtures.ts`
  (~80 lines)
- `frontend/src/features/apertures/hooks/useCanvasViewState.ts`
  (~50 lines)
- `frontend/src/features/apertures/hooks/useDeleteDimensionOrchestrator.ts`
  (~60 lines)
- `frontend/src/features/apertures/lib/aperture-constants.ts`
  (~10 lines)
- `frontend/src/features/apertures/__tests__/VerticalDimensionStrip.test.tsx`
- `frontend/src/features/apertures/__tests__/TotalDimensionsCaption.test.tsx`
- `frontend/src/features/apertures/__tests__/useApertureDimFormat.test.ts`
- `frontend/src/features/apertures/__tests__/usePickPasteHandlers.test.ts`

### Modified — components

- `components/ApertureCanvasContainer.tsx` (432 → ~340 LOC):
  memoise mirror; pass `pxW`/`pxH` down; extract the two
  hooks; fold the inline import-type; fix the
  `noDeleteTooltipShown` reset issue.
- `components/ApertureCanvasOverlay.tsx`: accept
  `displayedAperture` + `pxW` / `pxH` props; drop the local
  mirror call; drop the local dimension calc.
- `components/ApertureSvgCanvas.tsx`: accept
  `displayedAperture`; drop the local mirror call.
- `components/HorizontalDimensionStrip.tsx`: rename the
  `aperture` prop to `displayedAperture` for symmetry; move
  `LAST_ROW_REASON` to `canvas-constants.ts`.
- `components/VerticalDimensionStrip.tsx`: same constant move.
- `components/OperationRow.tsx`: add the WHY comment for blank
  metric cells.
- `components/ApertureHitTarget.tsx`: add the coordinate-system
  comment.
- `components/FramePicker.tsx`: pass no `manufacturers` for the
  "all rows" lookup; consume `totalRows` from props instead of
  firing a second `useFrameCatalog`.
- `components/GlazingPicker.tsx`: same picker fixes.
- `components/ApertureElementCardStack.tsx`: own the
  catalog-totals computation; pass `frameTotalRows` /
  `glazingTotalRows` into the pickers.
- `components/UValueChip.tsx`: use new `formatUValueNumeric()`.
- `components/RefreshDialog.tsx`: fix the seed-effect deps;
  remove the dead `typeof "number"` branch in `stringify`.
- `components/ProjectRefsView.tsx`: `useMemo` the two
  aggregations.
- `components/ManufacturerFiltersModal.tsx`: add the
  set-semantics comment.

### Modified — non-component

- `aperture-geometry.ts`: header note on absolute coordinates.
- `pick-paste-machine.ts`: collapse the dead ternary.
- `store/builder-store.ts`: fix `popUndoEntry`; drop
  `AperturePickPasteMode` (re-export `PickPasteMode` from the
  machine).
- `hooks/useApertureDriftReport.ts`: export query-key factory.
  (Or defer to Phase C-03 if that ships first.)
- `hooks.ts`: invalidate drift key after `refreshRefFromCatalog`.
- `hooks/useFrameCatalog.ts`, `hooks/useGlazingCatalog.ts`:
  expose a separate `useCatalogTotal` (or inline `totalRows`
  consumers — see Step 8).
- `hooks/usePickPasteHandlers.ts`: add self-paste WHY comment.
- `lib/inUseManufacturers.ts`, `lib/refsAggregation.ts`,
  `components/ApertureElementCard.tsx`: import `ALL_SIDES`.
- `operation-symbols.ts`, `frame-label-map.ts`: re-export
  `ViewDirection` from `types.ts`.
- `types.ts`: declare `ViewDirection` canonical here.
- `canvas-constants.ts`: add `LAST_ROW_REASON`,
  `LAST_COLUMN_REASON`.
- `format-u-value.ts`: add `formatUValueNumeric()`.
- `routes/AperturesTab.tsx`: collapse the three
  `*Context` indirections.

### Possibly deleted

- `components/EdgeAddButtons.tsx` — confirmed dead per
  review §L-3. Run `grep -rn EdgeAddButtons frontend/src`
  before deleting.

## P3. Implementation steps

Each step is a self-contained commit. `make frontend-dev-check`
or `pnpm exec vitest run <focus>` between steps; `make ci` at
phase close.

### Step 1 — `__tests__/test-fixtures.ts` extraction

1. Create the file with `makeFrameRef`, `makeGlazingRef`,
   `makeElement`, `makeEntry`, each accepting
   `Partial<FrameRef>` / etc.
2. Update each of the five test files (listed in P2) to import
   and call them. Delete the local builders.
3. `pnpm exec vitest run frontend/src/features/apertures`.

### Step 2 — Canvas mirror + pixel dim consolidation

1. In `ApertureCanvasContainer`:
   ```ts
   const displayedAperture = useMemo(
     () => mirrorApertureForInterior(aperture, viewDirection),
     [aperture, viewDirection],
   );
   const { pxW, pxH } = useCanvasPixelDimensions(
     displayedAperture, zoom,
   );
   ```
   (Or inline the calc if a hook feels over-engineered.)
2. Update `ApertureSvgCanvas` / `ApertureCanvasOverlay` /
   `HorizontalDimensionStrip` prop signatures:
   replace `aperture` with `displayedAperture` where they had
   been re-mirroring. Drop their internal mirror / dim calls.
3. Pass `pxW` / `pxH` into `ApertureCanvasOverlay`.
4. Update the three component tests.
5. Manual: open the Playwright MCP, verify exterior↔interior
   switch still mirrors correctly and that hit targets line up.

### Step 3 — `ALL_SIDES` + `ViewDirection` consolidation

1. Create `lib/aperture-constants.ts` with `ALL_SIDES`.
2. Move `ViewDirection` to `types.ts`. Re-export from the two
   original modules. Delete `ApertureViewDirection` from
   `ApertureSvgCanvas`.
3. Update consumers. TypeScript will flag every miss.

### Step 4 — `ApertureCanvasContainer` decomposition

1. Create `hooks/useCanvasViewState.ts` containing the zoom +
   view-direction state and the auto-fit effect. Move the
   container code lines 117 + 166-183 into it. Return
   `{ zoom, setZoom, viewDirection, setViewDirection, fit, ... }`.
2. Create `hooks/useDeleteDimensionOrchestrator.ts` containing
   `pendingDelete` state, the impact computation, and dialog
   wiring. Move container code 119 + 214-243. Return
   `{ pendingDelete, requestDeleteRow, requestDeleteColumn,
   confirmDelete, cancelDelete }`.
3. Container body now calls both hooks at the top and drops
   the inlined state. Existing container tests should pass
   without changes — if any break, the hook seam is wrong.
4. Add small focused tests for each new hook.
5. Fix the `noDeleteTooltipShown` module flag at the same time:
   move into hook state (cleanest fix), or call
   `__resetNoDeleteTooltipForTests()` in the container test's
   `beforeEach`.

### Step 5 — `popUndoEntry` contract fix

1. Refactor:
   ```ts
   popUndoEntry: (apertureId) => {
     const stack = get().undoStacksByAperture[apertureId] ?? [];
     const popped = stack.at(-1) ?? null;
     if (!popped) return null;
     set((state) => ({
       undoStacksByAperture: {
         ...state.undoStacksByAperture,
         [apertureId]: stack.slice(0, -1),
       },
     }));
     return popped;
   }
   ```
2. Add the test cases from §13 (push / pop / trim / clear,
   `pickPasteAction`, `dismissOperationWarning`).

### Step 6 — `RefreshDialog` seed effect

1. Add `entry` to the dep array; remove the `eslint-disable`.
2. Confirm `setRows(buildRowsFromDeltas(entry.deltas))` is
   idempotent for unchanged input (it is — string keys are
   stable). No behavior change for the common path; staleness
   gap closes.
3. Add a test: mount the dialog with delta set A; trigger a
   query refetch that returns delta set B; assert rows update.

### Step 7 — Picker manufacturer-filter fix

1. `FramePicker`: change the second `useFrameCatalog` call to
   pass no `manufacturers` argument (i.e., `useFrameCatalog()`).
2. `GlazingPicker`: same.
3. Add a test for each that asserts the current-value chip
   renders when the selected manufacturer is not in
   `effectiveManufacturers`.

### Step 8 — Catalog-totals hoist

1. Add `useCatalogTotal('frame')` / `useCatalogTotal('glazing')`
   (or just have `ApertureElementCardStack` call
   `useFrameCatalog()` / `useGlazingCatalog()` once each).
2. Pass `frameTotalRows` / `glazingTotalRows` down through
   element cards to the pickers.
3. Drop the second `useQuery` from inside
   `useFrameCatalog` / `useGlazingCatalog` (or expose it as an
   optional `withTotal` flag and use it from the parent only).
4. Performance verification: open Playwright MCP, mount an
   aperture with 4 elements × 4 sides, count `useQuery`
   subscribers in the React DevTools. Should be 2 totals + N
   filtered, not 2 + 2N.

### Step 9 — Drift query-key + invalidation

If Phase C-03 has not shipped by the time this step lands,
do it here. Otherwise mark this step "done in C-03".

1. Export `apertureDriftReportQueryKey()` from
   `useApertureDriftReport.ts`.
2. Add invalidation to `hooks.ts` in the
   `refreshRefFromCatalog` mutation success path.
3. Test in `__tests__/useApertureDriftReport.test.ts`.

### Step 10 — Small wins bundle (~one commit per group)

1. `pick-paste-machine.ts:28` ternary → `return "idle"`.
2. `ApertureCanvasContainer.tsx:104` inline-import fold.
3. WHY comments at the six sites listed in P1.12.
4. `UValueChip` switches to `formatUValueNumeric()`.
5. `AperturesTab.tsx` collapse three `*Context` indirections.
6. `RefreshDialog.stringify` dead branch removal.
7. `ProjectRefsView` `useMemo` aggregations.
8. `LAST_ROW_REASON` / `LAST_COLUMN_REASON` move into
   `canvas-constants.ts`.
9. `EdgeAddButtons.tsx` delete IF no other consumer found.
10. Drop `AperturePickPasteMode` alias from `builder-store.ts`;
    re-export `PickPasteMode`.

### Step 11 — Coverage backfill

1. Add the four new test files listed in P2.
2. Each test file is small and focused — pin one behavior
   each. No oversized "integration" tests.

## P4. Verification

- `make frontend-dev-check` green between steps.
- `pnpm exec vitest run frontend/src/features/apertures` green
  after each step.
- `make ci` green at phase close.
- Playwright MCP visual check: open an existing project, open
  the Apertures tab, switch view direction, hover an element,
  open the picker, switch the manufacturer filter, open the
  refresh dialog. No visual regressions.
- React DevTools: confirm the card stack no longer registers
  duplicate `useQuery` subscribers.

## P5. Risks

- **R-C04-1 — `displayedAperture` rename leaks into V1 windows
  code by accident.** The V1 `windows/` folder still exists.
  **Mitigation:** the renames are confined to `features/apertures/`;
  TS will flag any cross-feature drift.
- **R-C04-2 — Memoising the mirror changes a render shape.**
  Three siblings now read from the same `displayedAperture`
  reference, so referential equality holds across them. This
  fixes (not regresses) the pattern. **Mitigation:** existing
  snapshot tests will surface any unintended diff.
- **R-C04-3 — `popUndoEntry` refactor breaks a hidden caller.**
  Only `usePickPasteHandlers.undoLastPaste` calls it.
  **Mitigation:** the new test cases in Step 5 plus a focused
  read of every `popUndoEntry` reference.
- **R-C04-4 — Picker "all rows" change exposes a previously-
  hidden orphan ref.** If a project carries a frame whose
  manufacturer isn't in the current roster, the picker now
  renders that frame's chip. This is a fix, not a regression —
  but worth confirming with a designed fixture.
- **R-C04-5 — `EdgeAddButtons` is referenced from somewhere
  unexpected.** **Mitigation:** the explicit
  `grep -rn EdgeAddButtons frontend/src` gate in Step 10.9.
- **R-C04-6 — Hook extractions accidentally widen the public
  surface.** Both new hooks are internal to the canvas
  container. **Mitigation:** place them under
  `apertures/hooks/` (already feature-scoped) and never
  re-export from the feature root.

## P6. Out of scope

- BuilderDriftBanner / ProjectRefsView smoke tests (backlog
  E.3).
- Playwright E2E (backlog E.1).
- V1 fixture parity for u-value (backlog E.2).
- Sidebar collapse + chevron + sticky `+ Add` (backlog B.1).
- Sonner toast layer (backlog B.3).
- Region-click + pick-paste interaction (backlog B.4).
- Drift report side panel + jump-to-card (backlog B.5).
- Refresh dialog typed inputs (backlog B.7).
- Anything in V1 `frontend/src/features/windows/` (Phase C-01).
