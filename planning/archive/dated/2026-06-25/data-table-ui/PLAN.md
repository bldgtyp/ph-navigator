---
DATE: 2026-06-25
TIME: 01:36 EDT
STATUS: Complete - implemented in five phases
AUTHOR: Codex
SCOPE: Implementation sequence and verification strategy for DataTable UI.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/PRD.md
  - planning/archive/dated/2026-06-25/data-table-ui/STATUS.md
---

# DataTable UI - Plan

## Design Translation

Use the DESIGN-agent mockup as the visual target, but implement it
through the existing shared DataTable mechanics:

- keep fixed `colgroup` widths, column resize, sticky frozen columns,
  and virtualization;
- port mockup values into tokens and shared classes;
- standardize the current shared density around a 38px row/header rhythm
  while leaving any future comfortable/compact variants as a separate
  behavior decision;
- use the mockup's faint unit badge styling on a two-line header;
- restyle existing toolbar controls before adding new toolbar behavior;
- defer global search until search semantics are specified.

## Implemented Phase Sequence

The original design translation listed seven possible slices. During
implementation those collapsed into five committed phases because the shared
CSS/token, body-row, chip, toolbar, footer, and browser-polish work landed
cleanly together without needing separate behavior phases.

1. **Phase 00 - Redesign baseline and route matrix**
   - Capture current screenshots for representative DataTables.
   - Build a route matrix covering Rooms / Space Types, generic
     Equipment, Heat Pump leaves, Catalog tables, Apertures catalog
     tables, Attachment rows, and Thermal Bridges.
   - Record which tables use custom `footerAction`, attachment cells,
     linked-record cells, status fields, unit fields, and dense custom
     columns.

2. **Phase 01 - Numeric alignment and precision investigation**
   - Reproduce the decimal precision issue with a focused shared
     DataTable test.
   - Trace `config.precision`, `numberUnits.precision_si`, and
     `numberUnits.precision_ip` through field config, persisted schema,
     formatting, copy/paste, filters, and aggregations.
   - Add shared numeric alignment for all semantic number cells.
   - Render empty numeric cells as muted em dash without changing stored
     values.

3. **Phase 02 - Header density and unit sublabels**
   - Redesign the header content layout in the shared header path.
   - Replace the large description `"?"` trigger with a compact accessible
     marker.
   - Add an intentional double-height header mode for unit-bearing number
     fields and render the active unit below the field label.
   - Tune `FieldTypeIcon` scale/color to match the mockup without
     losing accessible field-type meaning.

4. **Phase 03 - Chip system**
   - Improve `status` chip colors, typography, and iconography.
   - Evaluate solid chip styling across `single_select`, linked-record,
     status, and toolbar chips.
   - Decide whether solid styling applies globally or only to status.
   - Do not globally strip numeric prefixes from labels; add an explicit
     presentation hook if a specific option list needs it.

5. **Phase 04 - Frontend-design polish and browser review**
   - Add tokenized shared table density: 38px data rows, 38px normal
     headers, 50px unit-bearing headers, 12px horizontal padding, and
     4px vertical cell padding.
   - Keep fixed `colgroup` layout and synchronize the virtualizer data-row
     estimate with `--data-table-row-height`.
   - Restyle existing toolbar, row, selection, active-cell, gutter, summary,
     unit-badge, field-icon, and ordinary single-select pill chrome.
   - Tune density, padding, borders, type scale, tint contrast, chips,
     and shell rhythm across representative tables.
   - Verify multiple real routes: Rooms / Space Types, Equipment tables,
     Heat Pump leaf tables, and Thermal Bridges through the route-smoke
     matrix.
   - Fold durable decisions into `context/technical-requirements/data-table.md`.

## Likely implementation seams

- `frontend/src/shared/ui/data-table/components/GridBody.tsx`
- `frontend/src/shared/ui/data-table/components/SortableHeaderCell.tsx`
- `frontend/src/shared/ui/data-table/components/GridHeader.tsx`
- `frontend/src/shared/ui/data-table/components/GridToolbar.tsx`
- `frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx`
- `frontend/src/shared/ui/data-table/components/FieldTypeIcon.tsx`
- `frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx`
- `frontend/src/shared/ui/data-table/components/FieldConfigSectionNumber.tsx`
- `frontend/src/shared/ui/data-table/components/FieldConfigSectionNumberUnits.tsx`
- `frontend/src/shared/ui/data-table/lib/rows/format.ts`
- `frontend/src/shared/ui/data-table/lib/columnWidths.ts`
- `frontend/src/shared/ui/data-table/DataTable.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/lib/units/numberUnits.ts`

## Verification

- Focused Vitest coverage for:
  - plain number precision display;
  - number-with-units precision display in SI and IP;
  - numeric cell alignment class/attribute behavior;
  - empty numeric cells render a muted dash;
  - density class changes row/header dimensions without breaking tests;
  - unit labels render on the second header line;
  - description trigger remains keyboard accessible;
  - default add-row ghost row inserts a row and queues edit;
  - status chip rendering for every canonical status option.
- Existing focused frontend check:
  - `cd frontend && pnpm exec vitest run <relevant files>`
  - `make frontend-dev-check`
- Browser/Playwright route pass on representative DataTables before
  closeout.
- `graphify update .` after code changes.

Full `make ci` is the closeout gate once implementation is done.
