---
DATE: 2026-06-25
TIME: 01:36 EDT
STATUS: Complete - archived
AUTHOR: Ed (via Codex)
SCOPE: Shared DataTable rendering polish for numeric alignment, decimal
  precision, header notes, unit labels, status chips, and dense visual styling.
RELATED:
  - context/technical-requirements/data-table.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/DataTable.css
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/components/SortableHeaderCell.tsx
  - frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumber.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumberUnits.tsx
---

# DataTable UI - Feature Folder

## Scope

Record and plan a shared `<DataTable>` rendering pass across all
DataTable-backed surfaces. This is the AirTable-style data-entry grid,
not the separate `report-table` primitive.

The requested changes are:

- Right-align every numeric cell, including plain `number` fields and
  number fields with `numberUnits`.
- Investigate why the Number field "Decimal precision" setting does not
  affect rendering as expected.
- Reduce the vertical stretch and footprint of the header description
  `"?"` affordance so it consumes less field-name space.
- Move number-with-units labels (`ft`, `Btu`, etc.) under the field name
  instead of beside it, with a deliberate double-height header mechanism.
- Improve built-in `status` chip typography, colors, and optional
  check/X icons.
- Evaluate whether all chip renderers should use solid fills with white
  text.
- Run a frontend-design pass on table padding, type scale, colors, row
  height, header density, chip sizing, and visual hierarchy.

## Read order

1. `PRD.md` - desired behavior and acceptance criteria.
2. `reviews/table-redesign-review.md` - review of the DESIGN-agent
   mockup and implementation translation.
3. `ROUTE_MATRIX.md` - Phase 00 source-backed DataTable consumer matrix
   and written baseline.
4. `PLAN.md` - proposed implementation sequence and verification.
5. `STATUS.md` - current state, next step, blockers.
6. Phase files under `phases/` when implementation starts.

## Non-goals

- No backend schema changes are expected unless the precision
  investigation proves the saved `config.precision` contract is broken.
- No one-off table-local styling. This must land in the shared DataTable
  path unless a consumer has a documented exception.
- No changes to the read-mostly `report-table` primitive.
