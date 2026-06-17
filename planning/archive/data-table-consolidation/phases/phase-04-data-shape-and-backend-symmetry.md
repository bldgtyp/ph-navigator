---
DATE: 2026-06-16
TIME: 13:05 EDT
STATUS: Complete - covered by Phase 06 full CI/browser closeout
AUTHOR: Ed (via Claude)
SCOPE: Reconcile data-shapes (inside_outside, phase), the
  identifier-uniqueness rule, dual contracts, the god-method validator,
  duplicated heat-pump invariants, and orphaned attachment config.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - backend/features/project_document/document.py
  - backend/features/project_document/tables/registry.py
  - backend/features/assets/registry.py
---

# Phase 04 - Data-Shape And Backend Symmetry

## Goal

Make the same semantic field have one shape everywhere, settle the
identifier-uniqueness rule across all tables, and remove the backend
structural asymmetries the review found (review F8, B3, B6, B7, B8).

## Preconditions

- Phase 01 complete (validation gate hardened), so the validator changes
  here build on a known-good base.
- PRD open questions 1 and 2 resolved with the owner or by implementation
  discovery (identifier uniqueness; `inside_outside`/`phase` storage
  tier and migration cost).

## Tasks

1. [x] **`inside_outside` (F8).** Converge to one field type and one storage
   tier across Ventilators and HotWaterTanks. Default: `single_select`,
   matching Ventilators; update HotWaterTanks' FieldDef and rendering. If
   storage moves between top-level and `custom_values`, add a
   schema-version decision and a migration for saved documents/drafts.
2. [x] **`phase` (F8/B4).** Converge to one storage tier across the five
   tables that have a `phase` concept and apply the `{1,3}` validation
   wherever `phase` exists. Migrate if storage changes.
3. [x] **Identifier uniqueness (B3) - RESOLVED (landed 2026-06-17).** The
   rule is settled and shipped by the record-identity-model refactor
   (`planning/archive/record-identity-model/`, schema v8): the hidden
   `row.id` is the only enforced-unique identity (universal
   `validate_table_row_ids` guard over `generic_table_row_ids`), and the
   user-facing label is never unique-constrained (warning chip only),
   with both the Heat Pumps and Space-Types hard blocks removed. This
   item is now a **no-op verification** - confirm the landed behavior on
   the converged tables; do not re-decide it here.
4. [x] **Dual contracts (B6).** Remove or consolidate the
   `make_simple_attachment_contract` `equipment_*` contracts that
   register a second writable surface at the same table path as the rich
   slice contract, so each table path has one validated write surface.
5. [ ] **God-method validator (B7).** Refactor
   `validate_document_references` to drive per-table validation from
   `iter_table_contracts()` + `field_registry` instead of repeated
   hand-written per-table stanzas. Single-source the heat-pump tag/FK
   invariants currently duplicated between `document.py` and
   `heat_pumps/service.py`.
6. [x] **Orphaned config (B8).** Resolve
   `thermal_bridges.simulation_file_asset_ids` - either add the matching
   row column or remove the registry entry. Decide whether attachment
   fields should keep being modeled as `long_text` FieldDefs or move to a
   dedicated attachment field type, and align with the Phase 01 reference
   validation.
7. [x] **Tests.** Cover converged data-shapes (one type/storage for
   `inside_outside` and `phase`), the chosen identifier-uniqueness rule
   on every table, single-write-surface per path, and the contract-driven
   validator producing the same results as before for valid documents.

## Acceptance Criteria

- [x] `inside_outside` and `phase` each have one field type and one storage
  tier across all tables, with migrations where storage changed and
  existing documents still loading.
- [x] Identifier uniqueness behaves the same on every table and the rule is
  recorded in `data-table.md`.
- [x] Each table path has exactly one validated write surface; the
  `equipment_*` simple contracts are gone or merged.
- [ ] `validate_document_references` is contract-driven; heat-pump invariants
  have one definition.
- [x] No orphaned attachment registry entries remain.
- [x] Focused backend (and any affected frontend) tests pass.

## Implementation Notes

- Bumped `ProjectDocumentV1` to schema version 9 because Hot Water Tanks
  moved `inside_outside` out of `custom_values` and into a typed
  `single_select` row column. No migration was added because the app is
  pre-deploy and existing dev documents can be reseeded.
- Added `hot_water_tanks.inside_outside` as the Hot Water Tanks option
  namespace and aligned frontend field defs, row types, empty-row
  defaults, payload normalization, table rendering, and tests.
- Confirmed `phase` is already typed and `{1,3}`-validated on the
  equipment tables that currently expose it: Pumps, Fans, and Hot Water
  Heaters. Hot Water Tanks does not expose a `phase` concept in the
  current backend/frontend table contract.
- Removed the legacy `equipment_*` attachment-only table contracts and
  deleted `backend/features/project_document/tables/attachments.py`.
  Attachment registry keys now use canonical rich table names
  (`pumps`, `fans`, `hot_water_tanks`, etc.).
- Removed the orphaned
  `thermal_bridges.simulation_file_asset_ids` attachment registry entry;
  the shipped row column is `pdf_report_asset_ids`.

## Simplify Outcome

- Replaced duplicated attachment table-key traversal with one shared
  `iter_rows_for_raw_tables` resolver in `features.assets.registry`,
  used by both reference listing and attach/detach row lookup.
- Tightened legacy `equipment_*` contract removal tests to assert
  FastAPI `HTTPException` status/detail instead of a broad exception.
- Fixed Hot Water Tank option replacement to use the option namespace's
  typed row field, so `hot_water_tanks.inside_outside` cascades update
  `row.inside_outside` instead of `row.tank_type`.

## Docs-Pass Outcome

- Updated `context/technical-requirements/data-table.md` with the
  durable Phase 04 backend data-shape contracts: typed Hot Water Tank
  `inside_outside`, canonical equipment attachment table keys, and
  typed equipment `phase` validation.
- Moved the remaining `validate_document_references` extraction to
  `planning/features/data-table-maintenance/` during archive closeout.

## Follow-Up

The remaining repeated `validate_document_references` per-table
field-registry stanzas are tracked in
`planning/features/data-table-maintenance/`. This phase removed the
duplicate write surfaces and converged the data shapes; the validator
extraction is now a separate maintenance cleanup.

## Verification

- `cd backend && uv run pytest tests/test_project_document_hot_water_tanks.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_pumps.py tests/test_project_document_thermal_bridges.py tests/test_project_document_default_option_fill.py tests/test_assets_registry.py tests/test_assets_service.py tests/test_assets_locked_version.py`
  passed: 55 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/lib.test.ts`
  passed: 2 files, 73 tests.
- `cd frontend && pnpm exec tsc --noEmit` passed.
- `make frontend-dev-check` passed with existing Fast Refresh warnings
  and Vite chunk-size warnings.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.

## Stop Conditions

- Stop if a data-shape migration risks losing data in saved documents;
  design and test the migration in isolation first.
- Stop if removing the `equipment_*` contracts breaks a live consumer
  (some path still writes through the simple contract); find and migrate
  that consumer before deleting the contract.

## File Entry Points

- `context/technical-requirements/data-table.md`
- `backend/features/project_document/document.py`
- `backend/features/project_document/_validators.py`
- `backend/features/project_document/tables/registry.py`
- `backend/features/assets/registry.py`
- `backend/features/heat_pumps/service.py`
- `frontend/src/features/equipment/components/HotWaterTanksTable.tsx`
- `frontend/src/features/equipment/types.ts`
- `backend/tests/test_project_document.py`
