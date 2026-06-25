---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Active - phased plan drafted
AUTHOR: Codex
SCOPE: Implementation sequence and verification strategy for DataTable UI.
RELATED:
  - planning/features/data-table-ui/PRD.md
  - planning/features/data-table-ui/STATUS.md
---

# DataTable UI - Plan

## Design Translation

Use the DESIGN-agent mockup as the visual target, but implement it
through the existing shared DataTable mechanics:

- keep fixed `colgroup` widths, column resize, sticky frozen columns,
  and virtualization;
- port mockup values into tokens and shared classes;
- make density explicit (`comfortable` about 44px, `compact` about
  34px);
- use the mockup's faint unit badge styling on a two-line header;
- restyle existing toolbar controls before adding new toolbar behavior;
- defer global search until search semantics are specified.

## Phase Sequence

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

3. **Phase 02 - Tokens, density, and table shell**
   - Add DataTable-specific tokens for comfortable/compact row padding,
     header background, row border, accent hover tint, primary-column
     accent line, footer background, and muted numeric empty value.
   - Make `data-table-shell-comfortable` and
     `data-table-shell-compact` real CSS variants.
   - Keep the table radius within the app system; translate the mockup's
     larger radius/shadow into restrained table-surface styling.
   - Preserve fixed layout; do not switch to `table-layout: auto`.

4. **Phase 03 - Header density and unit sublabels**
   - Redesign the header content layout in the shared header path.
   - Replace the large description `"?"` trigger with a compact accessible
     marker.
   - Add an intentional double-height header mode for unit-bearing number
     fields and render the active unit below the field label.
   - Tune `FieldTypeIcon` scale/color to match the mockup without
     losing accessible field-type meaning.

5. **Phase 04 - Body rows, add-row, and selection states**
   - Apply row typography, padding, right-aligned numeric rhythm,
     primary identifier accent edge, lighter row dividers, and softened
     hover/selection fills.
   - Convert the default add-row affordance from the footer plus button
     to a full-width ghost row when `buildEmptyRow` is available.
   - Preserve keyboard row insertion, queued edit on the first editable
     field, row context menu insertion, row selection, fill handle, and
     grouped-row behavior.

6. **Phase 05 - Chip system**
   - Improve `status` chip colors, typography, and iconography.
   - Evaluate solid chip styling across `single_select`, linked-record,
     status, and toolbar chips.
   - Decide whether solid styling applies globally or only to status.
   - Do not globally strip numeric prefixes from labels; add an explicit
     presentation hook if a specific option list needs it.

7. **Phase 06 - Toolbar and footer**
   - Restyle existing Filter / Sort / Group / Hide fields / overflow
     controls to the mockup's ghost-button treatment.
   - Move read-only/editable state from the top status chip into a quiet
     footer status indicator.
   - Add a footer summary row compatible with the existing summary bar
     and custom `footerAction`.
   - Decide whether global search is in scope; if yes, define search
     over formatted visible cell text, persistence, and interaction with
     existing filters.

8. **Phase 07 - Frontend-design polish and browser review**
   - Tune density, padding, borders, type scale, tint contrast, chips,
     and shell rhythm across representative tables.
   - Verify multiple real routes: Rooms / Space Types, Equipment tables,
     Heat Pump leaf tables, Materials/Catalog, Apertures/Frames/Glazings,
     and Thermal Bridges.
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
- Browser/Playwright visual pass on representative DataTables before
  closeout.
- `graphify update .` after code changes.

Full `make ci` is a closeout gate once implementation is done, not a
requirement for this docs-only planning capture.
