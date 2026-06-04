---
DATE: 2026-06-04
TIME: 09:30 ET
STATUS: DONE — `@tanstack/react-virtual` wired through `DataTable` and
        `GridBody` with spacer-row pattern. Active-cell and inline-edit
        rows are pinned via `scrollToIndex`. `tests/setup.ts` shims
        `offsetHeight`/`offsetWidth`/`ResizeObserver` so jsdom-backed
        tests can render the virtualizer. All 1030 frontend tests
        (including five DataTable consumer suites) pass unmodified.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add row virtualization to the shared `DataTable` body so it
       renders only the rows in (or near) the viewport. Preserve
       frozen columns, group headers, aggregates, selection, range
       fill, paste, keyboard navigation, and scroll-into-view.
       Verify all five existing consumers continue to pass tests.
RELATED:
  - ../PRD.md §P3 Phase 3, §P5
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md §1
  - context/PRD.md §11.3 (Data Tables)
  - context/technical-requirements/data-table.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
  - frontend/src/shared/ui/data-table/components/GroupHeaderRow.tsx
  - frontend/src/shared/ui/data-table/hooks/useGridSelection.ts (and siblings)
  - frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
  - frontend/src/features/equipment/components/RoomsTable.tsx
  - frontend/src/features/equipment/components/PumpsTable.tsx
  - frontend/src/features/assets/components/AttachmentRowsTable.tsx
  - frontend/src/features/equipment/routes/EquipmentPage.tsx
---

# Phase 3 — `DataTable` row virtualization

## P0. Goal

`DataTable` body renders only the rows intersecting (or near) the
viewport, plus a small overscan band. The cell click latency drops
to ≤ 50 ms perceived; the "Show deactivated" toggle re-render
drops from ~1,970 ms to ≤ 150 ms; rendered `<tr>` count stays ≤ 50
for the 410-row reference dataset.

Frozen columns, group headers + aggregates, selection ranges, range
fill, paste, keyboard navigation, sticky header, identifier-column
pinning, and inline editor focus/blur all keep working.

This is the only phase in this feature with a non-trivial risk
budget. It deserves its own PR and a dedicated review pass.

## P1. Files touched

- `frontend/src/shared/ui/data-table/DataTable.tsx` — wire up the
  virtualizer and pass virtual rows to `GridBody`.
- `frontend/src/shared/ui/data-table/components/GridBody.tsx` —
  accept virtual rows + a top/bottom spacer pattern; render group
  headers and aggregate rows correctly within the virtual list.
- `frontend/src/shared/ui/data-table/components/GroupHeaderRow.tsx`
  — confirm interaction with virtualizer (group headers are part of
  the same virtual list, not a separate render layer).
- `frontend/src/shared/ui/data-table/hooks/useGridSelection.ts` (or
  whichever hook holds active-cell state) — `scrollIntoView` should
  drive the virtualizer's `scrollToIndex`, not native DOM
  `scrollIntoView` (which won't work for rows not yet mounted).
- `frontend/src/shared/ui/data-table/DataTable.css` — verify
  `position: sticky` for frozen columns and header continues to
  work with the absolute-positioned virtual rows pattern; may need
  to switch to a translate-based pattern.
- `frontend/src/shared/ui/data-table/__tests__/` — add tests for
  the virtual scroll integration:
  - Render with 500 rows; assert ≤ 50 `<tr>` in DOM.
  - Scroll; assert different rows are present.
  - Activate a cell off-screen via keyboard; assert the virtualizer
    scrolls the row into view.
  - Range-select across the virtual boundary; assert the range
    contains the correct row IDs.

## P2. Implementation steps

1. Add `@tanstack/react-virtual` to `frontend/package.json`:
   ```bash
   cd frontend && pnpm add @tanstack/react-virtual
   ```
   Respect the pnpm 24-hour `minimumReleaseAge` rule
   (CLAUDE.md). Pick a version that satisfies it.

2. In `DataTable.tsx`, after `bodyPlan` is built, set up a
   row virtualizer:
   ```ts
   const virtualizer = useVirtualizer({
     count: bodyPlan.length,
     getScrollElement: () => scrollContainerRef.current,
     estimateSize: () => rowHeightPx,           // const ~32 px
     overscan: 8,
     getItemKey: (index) => bodyPlan[index].key, // stable id
   });
   ```
   `scrollContainerRef` must point at the actual scroll parent of
   the table. The existing table likely scrolls on its outer
   wrapper — confirm and re-use.

3. In `GridBody.tsx`, replace the `bodyPlan.map(...)` loop with the
   virtualizer's `getVirtualItems()` pattern. Insert two spacer rows
   (one before, one after) sized to consume the un-rendered
   `<tr>` heights:
   ```tsx
   const items = virtualizer.getVirtualItems();
   const totalSize = virtualizer.getTotalSize();
   const paddingTop = items.length > 0 ? items[0].start : 0;
   const paddingBottom =
     items.length > 0 ? totalSize - items[items.length - 1].end : 0;
   ```
   Render `<tr>` spacers with `style={{ height: paddingTop }}` /
   `paddingBottom` so the scrollbar geometry matches a fully-
   populated table. Use `aria-hidden="true"` on the spacers.

4. Group header rows and aggregate rows live in `bodyPlan` already
   (per the existing implementation). The virtualizer treats them
   like any other row — variable heights are handled by
   `estimateSize` + `measureElement`. If group headers have a
   different height than data rows, switch to:
   ```ts
   estimateSize: (index) =>
     bodyPlan[index].kind === 'group' ? groupHeaderPx : rowHeightPx,
   ```
   and call `virtualizer.measureElement(el)` from a `ref` on the
   `<tr>` so dynamic heights settle correctly.

5. `useGridSelection` (or wherever active-cell `scrollIntoView`
   lives): the current `el.scrollIntoView()` only works if `el` is
   mounted. After virtualization, an off-screen cell's `<tr>` does
   not exist. Update to:
   - Compute the row index in `bodyPlan` for the active cell.
   - Call `virtualizer.scrollToIndex(rowIndex, { align: 'auto' })`.
   - Then, after the next frame, query for the cell `<td>` and
     `el.scrollIntoView({ block: 'nearest', inline: 'nearest' })`
     for horizontal alignment (the virtualizer only handles
     vertical).

6. Range selection (Shift+arrow, Shift+click) must continue to
   resolve via row IDs from `bodyPlan`, not via DOM lookup. The
   existing implementation likely already does this — verify and
   fix only if it relies on iterating mounted `<tr>` elements.

7. Frozen columns: the existing `position: sticky` on `<td>` should
   continue to work because virtual rows render as real `<tr>`
   children with the same per-cell sticky positioning. If
   horizontal scroll interacts with absolute-positioned virtual
   rows (depends on which virtualizer pattern is chosen), prefer
   the "translate the table" approach over absolute positioning so
   sticky cells continue to work.

8. Sticky header (`<thead>`) is outside the virtualizer's container
   and unaffected. Confirm.

9. Inline editor (`InlineCellEditor.tsx`): when the user opens an
   editor on a row at the edge of the viewport, virtualizer
   scrolling can unmount the editor mid-edit. Add a guard: while
   `edit.editing` is non-null for a row index, force-include that
   index in the virtual range (via `range.startIndex` /
   `range.endIndex` adjustment, or by adding the editing row to a
   "must render" set).

10. Add unit + integration tests as listed in §P1.

11. Run all existing consumer test suites and fix any regressions
    **without** changing the consumer code:
    - `MaterialsCatalogPage.test.tsx`
    - `PumpsTable.reuse.test.tsx`
    - any Rooms / Attachments / EquipmentPage tests

12. Manual smoke via Playwright MCP on:
    - Materials Catalog (410 rows)
    - Rooms / Pumps in a seeded project (smaller datasets — make
      sure virtualization doesn't regress small-table behavior)

## P3. Acceptance criteria

- With 410 rows in `bodyPlan`, the DOM contains ≤ 50 `<tr>` elements
  under tbody at any one time (measured with the same
  `document.querySelectorAll('tbody tr').length` check from the
  trigger review).
- "Show deactivated" toggle on Materials Catalog completes in
  ≤ 150 ms perceived (measured the same way as the trigger review).
- Mid-table cell click registers active state in ≤ 50 ms perceived.
- Selection ranges (Shift+click, Shift+arrow, fill-handle drag)
  correctly span virtual-boundary regions.
- Keyboard navigation (Tab, Enter, arrows, PgUp, PgDn, Home, End)
  scrolls off-screen targets into view and lands on the right cell.
- Inline editor stays mounted on cells the user is editing, even if
  the user scrolls them off-screen briefly.
- Group headers + aggregate rows render in the correct positions
  and contain the right values.
- All five existing DataTable consumers' tests pass without
  modification to their source.
- `make ci` is green.

## P4. Verification commands

```bash
# Type + lint + tests
cd frontend && pnpm test -- data-table
cd frontend && pnpm test -- MaterialsCatalogPage RoomsTable PumpsTable

# Bundle size sanity (TanStack Virtual is small; just confirm)
cd frontend && pnpm run build

# Manual perf measurement, repeat baseline protocol from
# planning/code-reviews/2026-06-04/materials-catalog-performance-review.md
# and record the new numbers in ../STATUS.md.

# DOM sanity in DevTools console (with materials page open):
#   document.querySelectorAll('tbody tr').length  // expect ≤ 50
#   document.querySelectorAll('tbody td').length  // expect ≤ 50 * cols
```

## P5. Risk and mitigations

- **Regression in any consumer.** Five DataTable consumers; one
  bad assumption breaks everyone. Mitigations:
  1. Run all consumer test suites before merge.
  2. Manual smoke on each consumer page after merge.
  3. Land behind a feature flag? **No** — would defeat the
     simplification. Instead, take a careful PR and budget
     thorough review.
- **Sticky frozen columns.** If the virtualizer uses absolute
  positioning, sticky cells stop working. Prefer the spacer-row
  + normal flow pattern (per step P2.3). Verify horizontal scroll
  is unaffected.
- **Variable row heights.** Group header rows and rows with
  multi-line cells may differ in height. `measureElement` handles
  this but adds a layout pass per visible row. If it shows up in
  the profile, switch to fixed-height rows (single-line truncation)
  for non-group rows.
- **Scroll restoration.** If a user navigates away and back, the
  table should remember scroll position. The virtualizer doesn't
  do this on its own; not a regression since the current
  implementation also doesn't, but worth confirming.
- **A11y.** `aria-rowindex` / `aria-rowcount` should still reflect
  the total row count, not the rendered count. Spacer rows must be
  `aria-hidden="true"`.

## P6. Effort

~1–2 days for the core change. Add ~half a day for tests and
manual cross-consumer smoke. Single-PR scope.

## P7. Hand-off notes

Run Phases 1 and 2 first. Phase 3 should be measured against a
gzip-enabled, single-fetch baseline so the performance numbers
reflect the virtualization contribution cleanly rather than being
masked by the other two wins.

Open question for the implementing agent: confirm whether group
headers in `bodyPlan` carry a `kind` discriminator already (likely
yes — see `DataTable.tsx` lines around 172–192 referenced in the
trigger review). If not, add one before wiring `estimateSize` per
step P2.4.
