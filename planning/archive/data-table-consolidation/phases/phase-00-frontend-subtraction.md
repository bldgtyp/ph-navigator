---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Complete - covered by Phase 06 full CI/browser closeout
AUTHOR: Ed (via Claude)
SCOPE: Behavior-preserving frontend cleanup - export the shared
  single-select cell, delete dead per-table render code, and fix safe
  naming/typo/shadow defects.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - frontend/src/shared/ui/data-table/index.ts
  - frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
---

# Phase 00 - Frontend Subtraction

## Goal

Make the shared `SingleSelectCell` the single source of truth for
single-select rendering, delete the dead per-table render code that the
grid never reaches, and fix the safe, isolated defects. This phase is
net-negative LOC and must not change any user-visible behavior.

## Preconditions

- Current checkout builds and `make ci` is green.
- Confirmed render-dispatch contract: the grid renders
  `single_select` through `SingleSelectCell` before the column `render`
  fallback (`components/GridBody.tsx:523-549`).

## Tasks

1. [x] Export `SingleSelectCell` from
   `frontend/src/shared/ui/data-table/index.ts`. `SingleSelectPill`
   remains internal to avoid widening the public API beyond the phase
   need.
2. [x] Delete the per-table `optionPill` copies and the dead
   `render: (row) => optionPill(...)` entries on every single-select
   column (review F2/F3, 9 copies):
   - `AppliancesTable.tsx` (`appliance_type`, `energy_star`),
     `FansTable.tsx`, `HotWaterHeatersTable.tsx`, `HotWaterTanksTable.tsx`,
     `PumpsTable.tsx`, `VentilatorsTable.tsx`, `RoomsTable.tsx`,
     and `features/assets/thermal-bridges/ThermalBridgesTable.tsx`.
   - [x] Remove the now-orphaned inline `style={{ "--option-color": ... }}`
     passthrough that existed only to support the hand-built pill.
3. [x] Fix the `setCustomValue` shadow in
   `frontend/src/features/equipment/components/VentilatorRowModal.tsx`:
   remove the local `setCustomValue` and `readNumberInput`, and call the
   shared `setCustomValue` from `shared/ui/data-table` with the single
   shared signature.
4. [x] Remove the dead `data-table-inverse-link-cell` className in
   `PumpsTable.tsx` (no such class is defined in any CSS file); if the
   inverse-link cell needs a class, use the defined `data-table-link-cell`
   or leave it unstyled to match the registry path.
   - Also removed the same dead class from
     `frontend/src/features/equipment/heat-pumps/link-fields.ts`.
5. [x] Fix the `"Temperatur"` header typo in `HotWaterHeatersTable.tsx`
   and the compatibility field definition in
   `frontend/src/features/equipment/lib.ts`.
6. [x] Give the Pumps Datasheet column the same
   `fieldDefByKey.get(...)?.display_name ??` header lookup the other
   tables use (`PumpsTable.tsx`).
7. [x] Confirm focused coverage asserts shared single-select rendering:
   `GridBody.test.tsx` already proves `single_select` uses the shared
   pill before a column's custom `render` fallback; affected table reuse
   tests were updated/run where applicable.

## Implementation Notes

- Phase 00 landed as frontend-only subtraction: 13 files changed, net
  negative LOC, no schema/backend changes.
- The simplify pass found no blocking issues. The accepted cleanup was
  narrowing the public export to `SingleSelectCell` only; a broader
  nullable-number parser extraction was left out of scope for this
  phase.
- No stop condition was hit. The removed single-select render callbacks
  were covered by the shared grid dispatch path.

## Verification

- `rg -n "optionPill|data-table-inverse-link-cell|Temperatur|readNumberInput|function setCustomValue" frontend/src/features/equipment frontend/src/features/assets/thermal-bridges frontend/src/shared/ui/data-table`
  returned no stale Phase 00 symbols except the intended `Temperature`
  strings and shared `setCustomValue` definition.
- `git diff --check` passed.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx src/features/equipment/__tests__/FansTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/__tests__/RoomsTable.reuse.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx`
  passed for the existing matching files: 6 files, 23 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/RoomsTable.addField.test.tsx src/features/equipment/__tests__/RoomsTable.cellWritePersist.test.tsx src/features/equipment/__tests__/RoomsTable.customField.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx`
  passed: 4 files, 15 tests.
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx`
  passed: 12 tests.
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx`
  passed: 31 tests.
- `make frontend-dev-check` passed. Existing unrelated
  `react-refresh/only-export-components` warnings remain in Apertures
  files.
- Browser smoke was not run because no local frontend/backend servers
  were responding on `localhost:5173` / `localhost:8000`; keep the full
  browser sweep in Phase 06 with CI closeout.
- `make ci` intentionally not run per project instruction to defer full
  CI until Phase 06.

## Acceptance Criteria

- `SingleSelectCell` is on the public surface of `shared/ui/data-table`.
- No `optionPill` definition remains in any feature table file, and no
  single-select column carries a custom `render:`.
- Single-select cells render identically before and after (pill label,
  color, missing/unassigned states) across Rooms, all Equipment tabs,
  and Thermal Bridges - verified in the browser.
- `VentilatorRowModal` uses only the shared `setCustomValue`; no local
  shadow remains.
- No dead `data-table-inverse-link-cell` className remains; the
  `"Temperatur"` typo is fixed; Pumps Datasheet header uses the
  display-name lookup.
- Focused frontend tests pass; `make frontend-dev-check` is green.

## Stop Conditions

- Stop if removing a per-table `render:` changes rendered output for any
  column, which would mean that column's field type is not actually
  `single_select` and the dispatch assumption does not hold there.
- Stop if exporting `SingleSelectCell` requires exporting unstable
  internal types that would widen the public surface in an unintended
  way; coordinate a minimal export shape instead.

## File Entry Points

- `frontend/src/shared/ui/data-table/index.ts`
- `frontend/src/shared/ui/data-table/components/SingleSelectCell.tsx`
- `frontend/src/features/equipment/components/*Table.tsx`
- `frontend/src/features/equipment/components/VentilatorRowModal.tsx`
- `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx`
- `frontend/src/features/equipment/__tests__/*`
- `frontend/src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx`
