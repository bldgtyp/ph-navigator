---
DATE: 2026-06-17
TIME: 13:05 EDT
STATUS: Complete - archived after full CI/browser smoke
AUTHOR: Ed (via Claude)
SCOPE: Current state of the DataTable consolidation refactor planning.
RELATED:
  - planning/archive/data-table-consolidation/README.md
  - planning/archive/data-table-consolidation/PRD.md
  - planning/archive/data-table-consolidation/PLAN.md
---

# DataTable Consolidation - Status

## Current State

`Complete - archived after full CI/browser smoke`.

Phase 00 frontend subtraction is complete. It exports
the shared `SingleSelectCell`, removes dead per-table `optionPill`
renderers, routes the Ventilator modal through the shared
`setCustomValue`, fixes the hot-water-heater `Temperature` typo, and
removes the dead inverse-link class from Pumps / heat-pump link fields.

Phase 01 backend validation hardening is complete. It
adds repository-aware attachment asset-reference validation on write,
extends the attachment registry to heat-pump datasheet sub-tables,
validates Heat Pump option-id references against document option lists,
and applies range checks to shipped generic equipment numeric fields.

Phase 02 shared column builders is complete. It adds
shared link, attachment, identifier, semantic-width, and numeric-input
helpers, adopts them across the generic equipment tables and Thermal
Bridges, and records the shared column-builder contract in
`context/technical-requirements/data-table.md`.

Phase 03 shared row modal and links is complete. It
adds the shared row-edit modal/form helpers, migrates Rooms and
Ventilators onto the shared modal lifecycle, replaces contained modal
single-select / linked-record pickers with shared wrappers, unifies
incoming-link pill columns through a shared helper, and records the
row-edit / incoming-link contract in
`context/technical-requirements/data-table.md`.

Phase 04 data-shape and backend symmetry is complete.
It moves Hot Water Tanks `inside_outside` to the same typed
single-select row-column shape as Ventilators, bumps the dev schema to
v9, removes the legacy `equipment_*` attachment-only table contracts,
renames attachment registry equipment keys to canonical rich table
names, removes the orphaned
`thermal_bridges.simulation_file_asset_ids` registry entry, and records
the backend data-shape contract in
`context/technical-requirements/data-table.md`. The deeper
`validate_document_references` god-method extraction was extracted to
`planning/features/data-table-maintenance/`.

Phase 05A backend migration is complete. Heat Pumps now
has four per-leaf generic `TableContract`s under the existing
`equipment.heat_pumps` aggregate, with dev-schema v10 leaf envelopes
that store `{ field_defs, rows }` and row-level `custom_values` /
`custom_links` bags. The multi-row-type controller path remains
rejected; the generic controller stays one table key / one row type /
one field-def list / one schema fingerprint / one view-state key.

Phase 05B frontend controller adoption is complete.
Heat Pumps now fetches the four generic leaf table slices, composes one
`useSliceTableController` per leaf, routes grid writes through shared
controller `WriteOp`s, and no longer carries the forked
`useHeatPumpTableViewState` hook or stale PATCH fresh-etag cache test.
Outdoor Units cascade delete preview/confirm remains on the legacy
aggregate endpoint until the 05C/05D destructive-dialog/cascade cleanup.

Phase 05C shared render/modal cleanup is complete. Heat
Pump row modals now use the shared row-edit frame and modal field
helpers, the private `OptionPicker` is deleted, Heat Pump modal
single-selects use the shared autocomplete/select wrapper with optional
option creation, unit modals use the shared linked-record picker, and
the outdoor-unit cascade preview confirm uses the shared destructive
confirm primitive. `BlockedDeleteDialog` remains feature-specific
because it is an informational blocked-delete detail surface.

Phase 05B column-source cleanup is complete. Heat Pump
leaf tables now append shared custom-field columns from each leaf
controller's server schema, pass custom-field actions through to
`DataTable`, and keep built-in Heat Pump columns feature-local. Focused
coverage verifies server-returned custom fields and row `custom_values`
render on all four leaves.

Phase 05D focused parity tests are complete. Heat Pump
coverage now exercises generic row-operation payloads, fill-style
multi-row cell writes, linked-record persistence, server custom-field
rendering on all four leaves, generic custom-field schema mutations,
leaf table-view endpoint wiring, and viewer/read-only suppression of
custom-field edit affordances.

Phase 06 verification/docs closeout is complete. Full
`make format` + `make ci` passed, browser smoke passed on Rooms,
Ventilators, and all four Heat Pump leaves, `graphify update .` passed,
and durable DataTable rules were folded into
`context/technical-requirements/data-table.md` and
`context/CODING_STANDARDS.md`. Browser smoke caught and this phase fixed
Heat Pump linked-record schema drift: unit built-in link fields now
declare backend `linked_record` FieldDefs, and Heat Pump synthetic
computed columns append frontend-only FieldDefs when they need shared
renderers.

## Next Step

No active work remains in this archive. Follow-up cleanup moved to
`planning/features/data-table-maintenance/`.

## Phase Status

| Phase | State |
|---|---|
| 00 - Frontend subtraction | Complete - covered by Phase 06 full CI/browser closeout |
| 01 - Backend validation hardening | Complete - covered by Phase 06 full CI/browser closeout |
| 02 - Shared column builders | Complete - covered by Phase 06 full CI/browser closeout |
| 03 - Shared row modal and links | Complete - covered by Phase 06 full CI/browser closeout |
| 04 - Data-shape and backend symmetry | Complete - covered by Phase 06 full CI/browser closeout |
| 05 - Heat Pumps on shared abstraction | Complete - covered by Phase 06 full CI/browser closeout |
| 06 - Verification, docs, closeout | Complete - `make ci`, browser smoke, graphify, and docs pass green |

## Blockers

No blockers.

## Decisions Recorded

- The shared `data-table` package is canonical; the refactor uses it
  more rather than redesigning it.
- Single-select, link/linked-record, attachment, and identifier columns
  must render through one shared cell each, in grid and in modals.
- One shared row-edit modal/hook backs all per-row editors.
- Heat Pumps is sequenced last and must join the shared abstraction
  (controller + shell + `TableContract`), retiring its forked
  view-state hook and `OptionPicker`.
- The backend must validate asset-id and option-id references on every
  table's write path.
- Identifier-uniqueness becomes one rule for all tables, recorded in
  `data-table.md` (default: non-unique per the spec).
- Behavior-preserving phases (00, 02, 03) keep user-visible behavior;
  convergences are the only intended change.

## Follow-Up

Non-blocking cleanup items were moved to
`planning/features/data-table-maintenance/`.

## Open Questions Carried From The PRD

1. Identifier-uniqueness rule - RESOLVED and LANDED (2026-06-17) by the
   preceding record-identity-model refactor
   (`planning/archive/record-identity-model/`, schema v8): hidden
   `row.id` unique (universal guard), user-facing Display Name never
   constrained, Heat Pumps **and** Space-Types hard blocks removed.
   Phase 04's B3 item is now a no-op verification of the landed
   behavior; Phase 02's identifier helper inherits the shipped
   `isIdentifier`-flag baseline.
2. `inside_outside` / `phase` storage tier and migration cost -
   RESOLVED for Phase 04: Hot Water Tanks `inside_outside` now matches
   Ventilators as a typed single-select row column; `phase` remains a
   typed nullable number on tables that expose it and validates `{1,3}`.
3. Heat-pump slice on one controller vs per-sub-table slices - RESOLVED
   for Phase 05: use four per-leaf table contracts/controllers under the
   existing `equipment.heat_pumps` aggregate; do not build a multi-row
   controller variant.
4. Heat-pump custom-field storage path - RESOLVED for Phase 05: reshape
   to the standard `{ field_defs, rows }` envelope per leaf, with rows
   carrying `custom_values` and `custom_links`; schema v10 dev reset, no
   compatibility reader.
5. Asset-reference enforcement - RESOLVED for Phase 01 as
   reject-on-write. Read/load paths remain tolerant; write paths reject
   missing, cross-project, wrong-kind/content, and over-count attachment
   references before persistence.

## Verification Status

Phase 00 focused verification:

- Static cleanup searches found no stale `optionPill`, dead
  `data-table-inverse-link-cell`, `Temperatur`, local
  `readNumberInput`, or local `function setCustomValue` remains in the
  affected table paths.
- `git diff --check` passed.
- Focused Vitest runs passed:
  - affected equipment reuse tests: 6 files, 23 tests;
  - focused Rooms table tests: 4 files, 15 tests;
  - `SingleSelectPopover.test.tsx`: 12 tests;
  - `GridBody.test.tsx`: 31 tests.
- `make frontend-dev-check` passed with existing unrelated Apertures
  Fast Refresh warnings.
- Browser smoke was not run because local frontend/backend servers were
  not responding on `localhost:5173` / `localhost:8000`.
- `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.

Phase 01 focused verification:

- `cd backend && uv run pytest tests/test_assets_service.py tests/features/heat_pumps/test_heat_pumps.py tests/test_project_document_pumps.py`
  passed: 27 tests.
- `cd backend && uv run ruff check features/assets/reference_validation.py features/assets/registry.py features/project_document/document.py features/project_document/_validators.py features/project_document/drafts.py features/heat_pumps/service.py tests/test_assets_service.py tests/features/heat_pumps/test_heat_pumps.py tests/test_project_document_pumps.py`
  initially found import ordering only; fixed with `ruff check --fix`,
  then the focused pytest group passed again.
- Simplify review fixes are incorporated: upload-status rejection,
  `asset_mime_not_allowed` field-policy errors, shared project-asset
  test builder, single document dump per asset-reference scan, one
  hot-water-tank range check, and precomputed Heat Pump option-id sets.
- Docs-pass updated `context/technical-requirements/data-table.md` with
  the durable attachment reject-on-write backend validation rule.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke not applicable for this backend validation phase.

Phase 02 focused verification:

- `make format` passed.
- Focused Vitest passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/columns.test.tsx src/shared/ui/data-table/__tests__/columnWidths.test.ts src/shared/ui/data-table/__tests__/identifierColumn.test.tsx`
  (3 files, 29 tests).
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `make frontend-dev-check` passed. ESLint still reports Fast Refresh
  warnings in existing Apertures files and the new shared column-helper
  module; no lint errors.
- Simplify review fixes are incorporated: neutral numeric parser home,
  neutral ordered string-array equality helper, callback-capable
  attachment column helper, and inline `linkColumn` rendering.
- Docs-pass updated `context/technical-requirements/data-table.md` with
  the durable shared column-builder contract.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 03 focused verification:

- `make format` passed.
- Focused Vitest passed:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/row-edit.test.tsx src/shared/ui/data-table/__tests__/columns.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  (6 files, 32 tests).
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `make frontend-dev-check` passed. ESLint still reports Fast Refresh
  warnings in existing Apertures files and `shared/ui/data-table/columns.tsx`;
  no lint errors.
- Simplify review fixes are incorporated: shared modal CSS moved to
  `DataTable.css`, closed linked-record pickers no longer mount/sort
  candidates, and incoming-link columns distinguish id-array accessors
  from display-text accessors.
- Docs-pass updated `context/technical-requirements/data-table.md` with
  the durable shared row-edit and incoming-link helper contracts.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 04 focused verification:

- `cd backend && uv run pytest tests/test_project_document_hot_water_tanks.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_pumps.py tests/test_project_document_thermal_bridges.py tests/test_project_document_default_option_fill.py tests/test_assets_registry.py tests/test_assets_service.py tests/test_assets_locked_version.py`
  passed: 55 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/lib.test.ts`
  passed: 2 files, 73 tests.
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `make frontend-dev-check` passed with existing Fast Refresh warnings
  and Vite chunk-size warnings.
- Simplify review fixes are incorporated: shared attachment row
  resolver, precise legacy-alias exception assertions, and Hot Water
  Tank option replacement for the new `inside_outside` option namespace.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 05 design-spike verification:

- Current backend source inspected:
  `backend/features/heat_pumps/models.py`,
  `backend/features/heat_pumps/service.py`, and
  `backend/features/project_document/document.py`.
- Current frontend source inspected:
  `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
  and `frontend/src/features/equipment/heat-pumps/*`.
- Current generic backend table-contract source inspected:
  `backend/features/project_document/tables/contracts.py`,
  `backend/features/project_document/drafts.py`, and
  `backend/features/project_document/routes.py`.
- Design decision recorded in
  `planning/archive/data-table-consolidation/phases/phase-05-heat-pumps-design-spike.md`.
- No code changed in this spike slice; no tests or CI run.

Phase 05A focused verification:

- `cd backend && uv run pytest tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/features/heat_pumps/test_phius_export.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_default_option_fill.py -q`
  passed: 84 tests.
- `cd backend && uv run ruff check features/heat_pumps/models.py features/heat_pumps/service.py features/heat_pumps/phius_export.py features/project_document/document.py features/project_document/templates.py features/project_document/_validators.py features/project_document/tables/heat_pumps.py features/project_document/tables/registry.py features/project_document/tables/__init__.py features/project_document/tables/rooms.py features/project_document/tables/ventilators.py tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/features/heat_pumps/test_phius_export.py tests/test_project_document_default_option_fill.py`
  passed after import formatting.
- `graphify update .` completed after code changes.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.

Phase 05B focused verification:

- `cd frontend && pnpm exec tsc --noEmit` passed.
- `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  passed: 7 files, 32 tests.
- `make format` passed.
- `git diff --check -- . ':(exclude)graphify-out'` passed.
- `graphify update .` completed after code changes.
- Simplify review fixes are incorporated: custom-field writes route to
  the standard custom bags, inline option deltas persist in replace
  payloads, direct table tests assert generic payload scalar link ids,
  and repeated sanitize-column arrays are memoized.
- Docs-pass updated `context/technical-requirements/data-table.md` with
  the Heat Pump frontend leaf-controller contract.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 05B column-source cleanup focused verification:

- Heat Pump leaf tables now compose built-in columns with
  `customFieldColumnDefs` from each leaf controller's `tableSchema` and
  pass controller custom-field actions through to `DataTable`.
- Focused panel coverage now verifies server-returned custom fields and
  row `custom_values` render on outdoor equipment, indoor equipment,
  outdoor units, and indoor units.
- `make format` passed.
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  passed: 7 files, 33 tests.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 05C focused verification:

- `cd frontend && pnpm exec tsc --noEmit` passed.
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/row-edit.test.tsx src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorEquipRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitRowModal.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitRowModal.test.tsx`
  passed: 8 files, 38 tests.
- `make format` passed.
- `git diff --check -- . ':(exclude)graphify-out'` passed.
- Simplify review fixes are incorporated: `RowEditModal` suppresses
  delete in read-only mode, modal single-select options use a narrower
  reusable shape with memoized autocomplete options, shared
  `TextAreaField` removes repeated Notes blocks, and
  `ConfirmDestructiveDialog` is exported through the data-table barrel.
- Docs-pass updated `context/technical-requirements/data-table.md` with
  the shared modal helper and destructive confirm contract extensions.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke was completed in Phase 06.

Phase 05D focused verification:

- `make format` passed.
- `cd backend && uv run pytest tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/features/heat_pumps/test_phius_export.py tests/test_project_document_linked_record.py`
  passed: 66 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
  passed: 3 files, 23 tests.
- Full `make ci` and browser smoke intentionally remained Phase 06.

Phase 06 closeout verification:

- `make format` passed.
- `make ci` passed:
  - backend: 898 passed, 2 skipped, 1 warning;
  - frontend: 174 test files passed, 1674 tests passed;
  - production build passed with existing chunk-size warnings.
- Browser smoke passed on `http://localhost:5173` with backend
  `http://localhost:8000`, signed in as `codex@example.com`, covering:
  `/spaces/rooms`, `/equipment?tab=ventilators`,
  `/equipment?tab=pumps`, `/equipment?tab=fans`,
  `/equipment?tab=hot-water-heaters`,
  `/equipment?tab=hot-water-tanks`,
  `/equipment?tab=electric-heaters`, `/equipment?tab=appliances`,
  `/equipment/heat-pumps/equipment-outdoor`,
  `/equipment/heat-pumps/equipment-indoor`,
  `/equipment/heat-pumps/units-outdoor`, and
  `/equipment/heat-pumps/units-indoor`, and `/thermal-bridges`.
- `graphify update .` passed.
- Docs updated:
  `context/technical-requirements/data-table.md`,
  `context/CODING_STANDARDS.md`, this status ledger, and
  `phases/phase-06-verification-docs-closeout.md`.
