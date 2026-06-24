---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Complete - covered by Phase 06 full CI/browser closeout
AUTHOR: Ed (via Claude)
SCOPE: Bring Heat Pumps onto the shared controller / shell / TableContract
  path (design spike + implementation), retiring the forked view-state
  hook and OptionPicker and unlocking custom fields and uniform
  validation.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
  - planning/archive/data-table-consolidation/phases/phase-05-heat-pumps-design-spike.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - frontend/src/features/equipment/heat-pumps/
  - frontend/src/shared/ui/data-table/feature/
  - backend/features/heat_pumps/
  - backend/features/project_document/tables/registry.py
---

# Phase 05 - Heat Pumps On Shared Abstraction

## Goal

Eliminate the Heat-Pump fork. Bring all four heat-pump tables onto the
shared `useSliceTableController` + `<SliceTableShell>` + `<DataTable>`
stack and onto the generic backend `TableContract` path, so Heat Pumps
renders, behaves, and validates like every other table and gains custom
fields, locks, and formulas (review F1, F10, F5, B5). This is the largest
item and starts with a design spike.

## Preconditions

- Phases 00-04 are implemented/in review with focused checks green:
  shared single-select cell, shared column builders, shared row modal /
  single-select editor / linked-record picker, and the contract-driven
  backend validator all exist, so Heat Pumps migrates onto finished
  building blocks. Final closeout remains Phase 06.
- [x] Plan-31 custom-field/locks state confirmed (per PLAN cross-cutting
  risk 6): the current data-table contract and archived editable-fields
  PRD already establish `{ field_defs, rows }`, field registries,
  `custom_values`, `custom_links`, and derived built-in locks as the
  active path.

## Tasks

1. [x] **Design spike (gate).** Resolve, with a short written decision in
   this folder:
   - Heat-pump slice shape: one multi-row-type controller variant vs each
     heat-pump sub-table as its own slice (the slice currently carries
     indoor units / indoor equip / outdoor units / outdoor equip +
     option lists together).
   - Custom-field storage: whether heat-pump rows can carry
     `field_defs` / `custom_values` / `custom_links` (rows are currently
     flat models). If a storage reshape is required, scope it here or
     document deferring custom-field support with an explicit gap.
   - Backend path: bring heat pumps under the generic slice-replace +
     `FieldSchemaMutation` contract, or keep JSON-Patch with documented
     justification.
2. [x] **05A - Backend migration (B5).** Register heat-pump tables as
   generic `TableContract`s, gaining custom-field + uniform validation
   through the shared path. Reconcile the identifier-uniqueness behavior
   with the Phase 04 decision.
3. [x] **05B - Frontend controller adoption (F1/F10).** Introduce
   `HeatPumpsTableSlot` + `SlicePayloadBuilders` for the heat-pump
   table(s); delete the four bespoke `handleWrite` switches, the inline
   CRUD verbs, and the duplicated stale-etag cache dance. Remove
   `useHeatPumpTableViewState` and let the controller own view state.
4. [x] **05C - Shared rendering adoption (F5/F6).** Replace `OptionPicker` with the
   shared single-select editor (from Phase 03); replace the raw-`<select>`
   linked-record pickers with the shared `Picker`; move the heat-pump row
   modals onto the shared `<RowEditModal>` (from Phase 03); use the
   unified inverse/incoming-link column.
5. [x] **05B - Column source (F1).** Have the heat-pump columns consume server
   `tableSchema.fieldDefs` + `customFieldColumnDefs` (like Rooms) instead
   of statically building `FieldDef[]` client-side, so custom fields and
   locks render.
6. [x] **05C - Cleanup.** Remove `CascadePreviewDialog` / `BlockedDeleteDialog`
   duplication by reusing a shared destructive-confirm primitive if one
   exists; keep `PhiusExportDialog` as legitimately feature-specific but
   align its server-state fetch with TanStack Query.
7. [x] **05D - Tests.** Cover heat-pump tables through the shared controller path:
   cell/fill/insert/delete/duplicate, single-select parity, linked-record
   parity, custom-field add/edit/delete (or the documented gap), view
   state persistence, and locked/viewer read-only mode.

## Spike Outcome

Design spike accepted. Decision record:

`planning/archive/data-table-consolidation/phases/phase-05-heat-pumps-design-spike.md`.

## Implementation Split

The original Phase 05 scope is too large to land cleanly as one edit.
Continue through these sub-slices and keep this file as the parent
ledger:

1. **05A - Backend leaf contracts and v10 document shape.**
   Add the four heat-pump envelopes, seed built-in FieldDefs, register
   the four `TableContract`s, and keep heat-pump FK/option/asset
   validation green. Stop after focused backend verification and update
   this ledger before starting 05B.
2. **05B - Frontend shared controller adoption.**
   Replace the bespoke PATCH/cache/view-state path with generic table
   slice hooks and `useSliceTableController` per leaf. **Completed
   2026-06-17:** all four leaves now fetch through generic table-slice
   features, use per-leaf controllers, and route grid writes through
   controller `WriteOp`s. Outdoor-unit cascade preview/confirm still
   uses the legacy aggregate endpoint because it owns cross-leaf cascade
   side effects; cleanup remains in 05C/05D. **Column-source cleanup
   completed 2026-06-17:** all four leaf table shells append shared
   custom-field columns from the controller's server schema and forward
   controller custom-field actions to `DataTable`.
3. **05C - Shared render/modal cleanup.**
   Remove `OptionPicker`, adopt shared single-select and linked-record
   modal controls, and clean up duplicate destructive dialogs where a
   shared primitive fits. **Completed 2026-06-17:** all four row modals
   use the shared row-edit frame and modal field helpers, `OptionPicker`
   is deleted, linked-record modal fields use the shared picker, and the
   outdoor-unit cascade preview confirm uses the shared destructive
   confirm primitive. The blocked-delete dialog stays feature-specific
   because it is not a destructive confirmation.
4. **05D - Focused parity tests.**
   Cover row operations, cell writes, option edits, linked-record
   behavior, custom-field/schema mutations, and read-only mode. Browser
   smoke, broad cascade end-to-end checks, and Phius-export closeout
   stay in Phase 06 unless directly touched by 05A-05C work. **Completed
   2026-06-17:** focused tests now cover generic Heat Pump
   row-operation payloads, fill-style multi-row cell writes,
   single-select option deltas, linked-record persistence, custom-field
   schema mutations, leaf table-view endpoint wiring, and viewer-mode
   read-only custom-field behavior.

## 05A Acceptance

- Four heat-pump leaves are registered as generic `TableContract`s:
  outdoor equipment, indoor equipment, outdoor units, and indoor units.
- Project document schema is bumped to v10 and each heat-pump leaf uses
  `{ field_defs, rows }`.
- Heat-pump rows carry the standard `custom_values` and `custom_links`
  bags.
- Generic table read/replace and schema-mutation paths work for the
  heat-pump leaves.
- Existing heat-pump FK, option-id, and asset-reference validation
  remains enforced.
- Focused backend tests pass; full CI remains Phase 06.

## Progress Notes

2026-06-17:

- 05D focused parity tests completed.
- Added Heat Pump payload-builder coverage for shared controller
  row-insert, row-delete, row-duplicate, and fill-style multi-row cell
  write payloads.
- Added Heat Pump panel coverage for generic custom-field
  add/edit/duplicate/delete schema mutations through the leaf
  `custom-fields:mutate` endpoint.
- Added Heat Pump panel coverage for leaf table-view endpoint wiring and
  viewer/read-only suppression of custom-field mutation affordances.
- Existing Heat Pump focused coverage continues to verify
  linked-record scalar persistence, server custom fields on all four
  leaves, row-modal shared rendering, and cascade-preview behavior.
- Full CI and browser smoke were completed in Phase 06.
- 05B column-source cleanup completed.
- Added a Heat Pump-local column composition helper so all four leaves
  append `customFieldColumnDefs` from their leaf controller
  `tableSchema` after feature-local built-in Heat Pump columns.
- Forwarded each leaf controller's custom-field action handlers into
  `DataTable`, enabling the shared add/duplicate/edit/delete custom
  field UI wherever the controller can edit.
- Added focused panel coverage that feeds custom server `field_defs`
  and row `custom_values` through all four Heat Pump leaf endpoints and
  verifies the custom columns/values render under persisted view-state
  sanitization.
- Focused frontend verification passed:
  `cd frontend && pnpm exec tsc --noEmit`.
- Focused Heat Pump Vitest passed:
  `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  (33 tests).
- `make format` passed after code changes.
- Docs updated:
  `context/technical-requirements/data-table.md` now records that Heat
  Pump leaves compose shared custom-field columns/actions from the
  controller schema.
- Simplify fixes incorporated: formula `rows_computed` overlays pass
  through the Heat Pump custom-column helper, the focused test reuses
  the shared `tableFieldDef` fixture and production table-name
  constants, column memo dependencies no longer include the fresh
  controller object, and the status headline no longer looks like a
  rollback from 05C.
- 05C shared render/modal cleanup completed.
- Deleted the Heat Pump-only `OptionPicker`; modal single-select fields
  now use `ModalSingleSelectField`, including optional option creation
  for Heat Pump-owned option lists.
- Moved all four Heat Pump row modals onto `RowEditModal` plus shared
  `TextField`, `NumberField`, `TextAreaField`,
  `ModalSingleSelectField`, and `ModalLinkedRecordField` wrappers.
- Kept the unit modal linked-record behavior on the shared
  linked-record picker, with the existing inline create-equipment action
  retained for cross-leaf row creation.
- Reused `ConfirmDestructiveDialog` for the Outdoor Units cascade
  preview confirm while keeping `BlockedDeleteDialog` feature-specific
  for non-confirming blocked-delete details.
- Simplify fixes incorporated: read-only row modals no longer render
  delete actions, modal select options use a narrow shared shape and
  memoized autocomplete options, repeated Notes textareas are replaced
  by `TextAreaField`, and the destructive confirm primitive is exported
  from the data-table barrel.
- Focused frontend verification passed:
  `cd frontend && pnpm exec tsc --noEmit`.
- Focused Heat Pump / row-edit Vitest passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/row-edit.test.tsx src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  (38 tests).
- `make format` and `git diff --check -- . ':(exclude)graphify-out'`
  passed after code changes.
- Docs-pass updated
  `context/technical-requirements/data-table.md` with the durable shared
  modal helper and destructive confirm contract extensions.
- 05B frontend controller adoption completed.
- Added four frontend generic table-slice features for
  `heat_pumps_outdoor_equip`, `heat_pumps_indoor_equip`,
  `heat_pumps_outdoor_units`, and `heat_pumps_indoor_units`.
- `HeatPumpsPanel` now fetches all four generic leaf slices and composes
  one `useSliceTableController` per leaf; the active tab passes its
  leaf controller into the existing Heat Pump table surface.
- Deleted `useHeatPumpTableViewState`; Heat Pump table view state now
  uses the shared `useProjectTableViewState` path inside
  `useSliceTableController`.
- Removed the four bespoke grid `handleWrite` switches and the stale
  PATCH fresh-etag test; grid writes and own-row modal add/edit/delete
  now dispatch generic controller `WriteOp`s.
- Simplify fixes incorporated: Heat Pump payload builders now route
  custom writes through `custom_values` / `custom_links`, preserve inline
  single-select option deltas, reuse shared link-id helpers, avoid
  per-render sanitize-column identity churn, and assert scalar
  linked-record persistence through the generic payload builders.
- Kept the Outdoor Units destructive cascade preview/confirm on the
  legacy aggregate endpoint for this slice because it still coordinates
  cross-leaf side effects; this is carried into 05C/05D cleanup rather
  than hidden as compatibility work.
- Focused frontend verification passed:
  `cd frontend && pnpm exec tsc --noEmit`.
- Focused Heat Pump Vitest passed:
  `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  (32 tests).
- `make format`, `git diff --check -- . ':(exclude)graphify-out'`, and
  `graphify update .` completed after code changes.
- Docs-pass updated
  `context/technical-requirements/data-table.md` with the durable Heat
  Pump frontend leaf-controller contract.
- 05A backend migration completed.
- Added four generic Heat Pump leaf `TableContract`s:
  `heat_pumps_outdoor_equip`, `heat_pumps_indoor_equip`,
  `heat_pumps_outdoor_units`, and `heat_pumps_indoor_units`.
- Bumped the dev project-document schema to v10 and reshaped each Heat
  Pump leaf to `{ field_defs, rows }`; no compatibility reader added per
  pre-deploy/no-user instruction.
- Heat Pump rows now carry `custom_values` and `custom_links`, and the
  document validator enforces standard FieldDef/custom-value/custom-link
  rules on all four leaves.
- Existing Heat Pump option-id, FK, cross-table ERV/Room cascade, asset
  validation, and Phius export paths were adapted to the new envelope
  shape.
- Generic read/replace/schema mutation was verified on
  `heat_pumps_outdoor_equip`; missing-FK rejection was verified through
  the generic `heat_pumps_outdoor_units` replace path.
- Focused backend verification passed:
  `cd backend && uv run pytest tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/features/heat_pumps/test_phius_export.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_default_option_fill.py -q`
  (84 tests).
- Focused Ruff passed on touched backend files and tests.
- `graphify update .` completed after code changes.
- Design spike completed and accepted.
- Source inspection confirmed current Heat Pumps is a flat four-list
  aggregate with no row-level custom-field bags.
- Generic contract inspection confirmed the clean shared abstraction is
  one table path, one row type, one field-def list, one schema
  fingerprint, and one view-state key.
- No implementation code changed in this spike slice.

## Acceptance Criteria

- All four heat-pump tables compose the shared controller + shell +
  DataTable; no bespoke `handleWrite` switches remain.
- `useHeatPumpTableViewState` is removed; `OptionPicker` is removed.
- Heat-pump single-selects, links, and row modals use the shared
  components and behave identically to the rest of the app.
- Heat-pump tables support user custom fields, locks, and formulas - or
  the gap is explicitly documented with a reason.
- Backend heat-pump writes go through the generic contract path, or the
  divergence is documented and its DTO/validation layering is cleaned up.
- Focused frontend and backend tests pass; browser smoke confirms parity
  across all heat-pump leaves.

## Stop Conditions

- Stop at the spike gate if neither slice shape fits the shared
  controller without unacceptable complexity; record the decision and
  re-scope before writing migration code. **Resolved 2026-06-17:** four
  per-leaf table contracts fit the shared controller; no multi-row-type
  controller will be built.
- Stop if custom-field storage for heat-pump rows requires a schema
  reshape that conflicts with in-flight Plan-31 work; coordinate
  sequencing before proceeding. **Resolved 2026-06-17:** the reshape is
  exactly the Plan-31 `{ field_defs, rows }` shape, and no conflicting
  Plan-31 work remains active.
- Stop if the backend migration would change saved heat-pump documents in
  a way that cannot be migrated safely. **Not blocking:** pre-deploy,
  no existing users/deploy; use a schema v10 dev reset/reshape rather
  than compatibility shims.

## File Entry Points

- `frontend/src/features/equipment/heat-pumps/components/*Table.tsx`
- `frontend/src/features/equipment/heat-pumps/*-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/components/*RowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/components/OptionPicker.tsx`
- `frontend/src/features/equipment/heat-pumps/routes/HeatPumpsPanel.tsx`
- `frontend/src/shared/ui/data-table/feature/`
- `backend/features/heat_pumps/`
- `backend/features/project_document/tables/registry.py`
