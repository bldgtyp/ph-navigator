---
DATE: 2026-06-24
TIME: 11:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Phase 03 — frontend schemas, columns, row/payload builders, and UI tests for the three new tables.
RELATED: planning/archive/data-table-status-field-addendum/PLAN.md
---

# Phase 03 — Frontend Types, Defaults, and UI

## Goal

`Status` renders as an editable single-select column on Ventilators, Heat-Pump
Outdoor Units, and Heat-Pump Indoor Units through the shared DataTable machinery —
no bespoke cell, defaulting to `Needed`, preserved on duplicate, and flowing
through filter/sort/group/CSV/row-detail.

## Steps

### Ventilators (shared-table path — mirror PumpsTable)

1. In `components/VentilatorsTable.tsx`, import `statusColumn` from
   `../lib/statusColumn` and insert `statusColumn<VentilatorRow>(fieldDefByKey)`
   into the `columns` array (placement consistent with `PumpsTable.tsx:231`,
   typically near the attachment/identifier columns).
2. In `lib/buildEmptyVentilatorRow.ts`, carry `fieldDefaults.status` into
   `custom_values.status` (reuse the shared `readStatusDefault` /
   `shared/lib/fieldDefaults.ts` helper the original feature introduced).
3. Extend the ventilator option-map type (in `equipment/types.ts` or the
   ventilator types module) so the `ventilators.status` key type-checks; resolve
   the local `status` FieldDef from the namespaced option list via
   `useTableSchema`, as the other shared tables do.

### Heat-Pump Units (parallel HP path — mirror the equip columns)

4. In `heat-pumps/outdoor-unit-columns.tsx` and `indoor-unit-columns.tsx`:
   - Add `statusFieldDef(options[…_UNITS_STATUS_OPTION_KEY] ?? [])` to the FieldDef
     list (mirror `outdoor-equip-columns.tsx:103`).
   - Add `statusColumnDef<…UnitRow>()` to the column list (mirror
     `outdoor-equip-columns.tsx:251`).
   (`heat-pumps/status-column.ts` already exports both helpers, leaf-agnostic.)
5. Extend the Units option maps in `heat-pumps/types.ts` and the resolver in
   `heat-pumps/option-helpers.ts` to include the `…_UNITS_STATUS_OPTION_KEY`.
6. Carry the status default in `heat-pumps/row-builders.ts` and the value in
   `heat-pumps/payload-builders.ts` for the unit builders.
7. In `components/OutdoorUnitsTable.tsx` / `IndoorUnitsTable.tsx`, wire the
   `status → setCustomValue` cell-write seam exactly as the equip leaves do, so an
   edited status persists into `custom_values.status`.

### Tests

8. Add/extend focused tests asserting the `Status` column renders, defaults to
   `Needed` on a new row, and edits/persists through the shared cell path:
   - `__tests__/VentilatorsTable.reuse.test.tsx`
   - `heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`
   - `heat-pumps/__tests__/IndoorUnitsTable.test.tsx`
   Reuse `heat-pumps/__tests__/statusOptionFixtures.ts` /
   `testing/statusFixtureOptions.ts` for option fixtures.

## Constraints

- No bespoke status cell renderer — the generic single-select pill already paints
  the four option colors (resolved in the original feature).
- Do not modify `VentilatorRowModal` in this packet unless Ed approves the open
  decision; the inline column is the authoritative affordance.

## Verification

- `make frontend-dev-check` green (format/lint/check:all/tsc/build).
- `pnpm exec vitest run` green, including the three new/extended table tests.
- `pnpm run format` applied.

## Done when

All three tables show an editable `Status` single-select column via shared
machinery, new rows default to `Needed`, duplicate preserves status, and the
frontend gate is green.
