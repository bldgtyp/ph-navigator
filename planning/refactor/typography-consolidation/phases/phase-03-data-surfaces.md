---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: Not started
AUTHOR: Codex
SCOPE: DataTable, ReportTable, catalog toolbar, and table-adjacent equipment
  typography
DEPENDS_ON: Phase 2
RELATED:
  - `../PRD.md`
  - `../../../code-reviews/2026-07-17/font-audit/REPORT.md`
---

# Phase 3 — Data surfaces and catalogs

## Goal

Normalize the densest and widest-reaching data UI without changing table
behavior, row geometry, or the deliberate 13px body-density decision.

## Primary owners

- `frontend/src/shared/ui/data-table/DataTable.css`
- `frontend/src/shared/ui/report-table/ReportTable.css`
- `frontend/src/features/catalogs/catalogs.css`
- `frontend/src/features/equipment/equipment.css`
- DataTable/catalog components only where shared role classes must be attached

## Build

1. Migrate every typography finding in the owner files, not only selectors
   visible in the 22-state sweep.
2. Fix the known computed outliers: 8.64px footer labels/status, 650 toolbar
   title, 10px summary chevron (D5), add-row/add-field glyph ownership, and
   catalog 14.4/14.72px em compounding.
3. Preserve `--data-table-font-size: 13px` for body cells. Normalize table
   header, units, footer/status, row-number, popover/editor, formula, grouping,
   and empty-state roles around it.
4. Replace raw mono fallback stacks in component CSS with family tokens.
5. Reuse Phase 2 button roles for toolbar, footer, popover, and modal actions;
   do not establish a private table button system.
6. Remove resolved owner fingerprints from the debt baseline.

## Verification

- Focused sweep states: all catalogs, catalog create/record modals, equipment,
  heat pumps, spaces rooms/types, and thermal bridges.
- Existing DataTable interaction suite passes; typography changes must not
  regress resize, inline edit, popovers, selection, or row expansion.
- Screenshots compare toolbar, header, first body row, footer, open popover,
  inline editor, and record modal at desktop and responsive widths.
- Measure row/header heights and overflow; no density or vertical-alignment
  regression.
- Role targets: table header/units/cell/footer render only approved variants;
  table actions use Phase 2 tiers.
- `make frontend-dev-check` during iteration; `make format` and `make ci` at
  phase closeout.

## Done when

All typography declarations owned by DataTable, ReportTable, catalogs, and
equipment are compliant and their baseline fingerprints are gone.
