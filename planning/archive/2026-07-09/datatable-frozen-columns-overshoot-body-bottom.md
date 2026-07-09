---
DATE: 2026-07-09
TIME: 12:48
STATUS: Fixed (2026-07-09)
AUTHOR: Ed May (reported), Claude (recorded)
SCOPE: DataTable — sticky gutter + frozen columns extend below the body's
       last row into the footer strip
RELATED:
  - feedback_datatable_uniformity_ironlaw
  - planning/refactor/data-table-ui-tweaks/ (visual grid polish packet)
  - context/UI_UX.md
---

# DataTable: frozen/gutter columns don't end at the same bottom edge as the body

## Summary

On DataTables, the **sticky left columns** (row-number **gutter** + the frozen
display-name column) **overshoot the bottom of the scrollable body** — their
tinted background extends roughly one partial row past the body's last gridline,
bleeding down toward/into the footer strip (`COUNT … EDITABLE`). The body cells
and the frozen cells for the last row do not terminate at the same Y.

Ed's instinct: "must be a div nesting issue." Close — it's a stacking /
containment boundary issue between the **virtualized body** and the
**sticky columns**, not a simple wrong-parent nesting.

## Observed behavior

- Frozen gutter + display-name column paint below the last body row (e.g. row
  26 "212 — Mech. Storage" shows in the frozen columns while its body cells are
  blank/short, and the frozen fill bulges lower than the body).
- The body's grid ends at the last row's measured bottom; the frozen lane keeps
  going for a partial row.

## Expected behavior

The frozen/gutter columns and the scrollable body must share the exact same
bottom edge. The sticky lane should never paint past the end of the rendered
body.

## Root cause (already known + partially guarded)

This is a documented failure mode of the row virtualizer. In
`frontend/src/shared/ui/data-table/DataTable.css` the scroll container already
carries a guard comment and fix attempt (`:29-34`):

```css
.data-table-scroll {
  overflow: auto;
  max-height: calc(100dvh - var(--data-table-page-chrome) - var(--data-table-footer-height));
  /* Sticky gutter/frozen cells can otherwise paint past the scrollport
     when the virtualized body ends mid-row. Keep the scrollport as the
     single clipping and stacking boundary for table chrome. */
  contain: paint;
  isolation: isolate;
}
```

The `contain: paint` + `isolation: isolate` guard clips painting to the
scrollport, but it does **not** fix this case: when the virtualizer's total
content height (spacer) is slightly taller than the sum of the actually-mounted
row heights — the classic estimated-row-height gap — the sticky gutter/frozen
`<td>` backgrounds fill down to the spacer's full height, which is *inside* the
scrollport, so `contain: paint` never clips it. Result: the frozen lane extends
~one partial row below the body's last real gridline.

The footer strip (`.data-table-footer-row`, `DataTable.css:718`) is a separate
sibling below `.data-table-scroll`, so the overshoot reads as the frozen columns
"leaking" toward the footer.

## Hypothesis / where to look

- Row virtualizer total-size vs. measured-rows gap: make the virtual list's
  total height exactly equal the sum of mounted row heights (measure real
  heights; eliminate the estimate remainder), so there is no extra spacer
  region for the sticky cells to fill.
- Alternatively/additionally: ensure the sticky gutter + frozen-column cells
  cannot stretch beyond the last body row (e.g. the body's bottom spacer row
  must not carry the gutter/frozen background; or bound the frozen lane to the
  measured body height).
- Start in `GridBody.tsx` (virtualizer + row rendering) and the gutter/frozen
  sticky `<td>` rules (`DataTable.css:1424-1445`, `.data-table-gutter*`), plus
  the `.data-table-scroll` containment block (`:25-34`).

## Repro

1. Open a project → SPACES / ROOMS (or any DataTable with enough rows to fill
   the viewport; the example is a 26-row table).
2. Scroll so the last row is visible at the bottom of the scrollport.
3. Compare the bottom edge of the sticky gutter / frozen display-name column to
   the bottom edge of the scrollable body cells → the frozen lane extends lower.

## Actual root cause — z-index inversion (NOT the virtualizer)

The virtualizer-spacer hypothesis above is **wrong** (kept for the record).
Reproduced the exact symptom in a faithful static browser harness (sticky
header + sticky-left gutter/frozen body cells + sticky-bottom summary
`<tfoot>`): it is a **stacking-order inversion between the sticky summary bar
and the sticky body columns**, with no virtualizer involvement.

- The aggregation **summary bar** is a `<tfoot class="data-table-summary-bar">`
  rendered inside the `<table>`, `position: sticky; bottom: 0`, at
  `z-index: z-base + 2` (`DataTable.css`).
- The body's sticky **gutter** cells are `z-base + 7` and the sticky **frozen**
  column cells are `z-base + 5`.
- When the summary bar is pinned and floats over lower body rows (scrolled
  down but not fully at the bottom — exactly the repro's "scroll so the last
  row is visible"), those higher-z body sticky cells **paint over** the
  summary bar. So the gutter + frozen lane appears to bleed one partial row
  past the body's last gridline into the footer strip — precisely the report
  ("row 26 shows in the frozen columns … the frozen fill bulges lower than
  the body").
- The sticky **header** never has this problem because it deliberately sits
  *above* the body sticky cells (`thead` gutter `z-base + 9`, frozen
  `z-base + 8`). The summary bar was simply never given the symmetric z.

## Fix

Two lines in `frontend/src/shared/ui/data-table/DataTable.css`:

- `.data-table-summary-bar` z-index `z-base + 2` → **`z-base + 8`** (bottom
  chrome now sits above the body gutter/frozen lane, mirroring the header).
- `.data-table td.data-table-cell-active[data-row-edge="bottom"]` z-index
  `z-base + 4` → **`z-base + 9`**, so the "bottom-row active chrome clears the
  summary bar" behavior is preserved against the raised summary z.

Raising only the `<tfoot>` z-index is sufficient — its sticky positioning +
z-index create a stacking context, so its (unchanged) inner gutter cell paints
above the body lane once the whole tfoot outranks it.

## Verification

- Faithful static harness reproduced the bug (blue gutter + green frozen
  bleeding over the pink summary bar) and confirmed the fix (summary renders
  as one clean strip; last row correctly hidden behind it) in Chromium via
  Playwright. Before/after screenshots captured during the session.
- `make ci-frontend`: green (format + lint + typecheck + 2076 tests + build).
- Recommended real-app spot check (not blocking): open a table with enough
  rows to scroll (SPACES/ROOMS), scroll so the last row sits just above the
  summary bar, and confirm the gutter/frozen lane ends at the body's last
  gridline.

## Status

Fixed 2026-07-09. Root cause corrected from the original virtualizer
hypothesis to a summary-bar z-index inversion. Recorded from user report.
