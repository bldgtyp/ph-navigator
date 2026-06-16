---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Behavior-preserving frontend cleanup - export the shared
  single-select cell, delete dead per-table render code, and fix safe
  naming/typo/shadow defects.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
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

1. Export `SingleSelectCell` (and its pill, if separable) from
   `frontend/src/shared/ui/data-table/index.ts`.
2. Delete the per-table `optionPill` copies and the dead
   `render: (row) => optionPill(...)` entries on every single-select
   column (review F2/F3, 9 copies):
   - `AppliancesTable.tsx` (`appliance_type`, `energy_star`),
     `FansTable.tsx`, `HotWaterHeatersTable.tsx`, `HotWaterTanksTable.tsx`,
     `PumpsTable.tsx`, `VentilatorsTable.tsx`, `RoomsTable.tsx`,
     and `features/assets/thermal-bridges/ThermalBridgesTable.tsx`.
   - Remove the now-orphaned inline `style={{ "--option-color": ... }}`
     passthrough that existed only to support the hand-built pill.
3. Fix the `setCustomValue` shadow in
   `frontend/src/features/equipment/components/VentilatorRowModal.tsx`:
   remove the local `setCustomValue` and `readNumberInput`, and call the
   shared `setCustomValue` from `shared/ui/data-table` with the single
   shared signature.
4. Remove the dead `data-table-inverse-link-cell` className in
   `PumpsTable.tsx` (no such class is defined in any CSS file); if the
   inverse-link cell needs a class, use the defined `data-table-link-cell`
   or leave it unstyled to match the registry path.
5. Fix the `"Temperatur"` header typo in `HotWaterHeatersTable.tsx`.
6. Give the Pumps Datasheet column the same
   `fieldDefByKey.get(...)?.display_name ??` header lookup the other
   tables use (`PumpsTable.tsx`).
7. Update or add focused tests so single-select rendering is asserted
   against the shared `SingleSelectCell` output, not per-table markup.

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
