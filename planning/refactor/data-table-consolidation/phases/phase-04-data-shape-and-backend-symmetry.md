---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Reconcile data-shapes (inside_outside, phase), the
  identifier-uniqueness rule, dual contracts, the god-method validator,
  duplicated heat-pump invariants, and orphaned attachment config.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - backend/features/project_document/document.py
  - backend/features/project_document/tables/registry.py
  - backend/features/project_document/tables/attachments.py
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

1. **`inside_outside` (F8).** Converge to one field type and one storage
   tier across Ventilators and HotWaterTanks. Default: `single_select`,
   matching Ventilators; update HotWaterTanks' FieldDef and rendering. If
   storage moves between top-level and `custom_values`, add a
   schema-version decision and a migration for saved documents/drafts.
2. **`phase` (F8/B4).** Converge to one storage tier across the five
   tables that have a `phase` concept and apply the `{1,3}` validation
   wherever `phase` exists. Migrate if storage changes.
3. **Identifier uniqueness (B3) - resolved upstream.** The rule is
   settled by the record-identity-model refactor
   (`planning/refactor/record-identity-model/`): the hidden `row.id` is
   the only enforced-unique identity (universal guard), and the
   user-facing label is never unique-constrained (warning chip), with
   Heat Pumps' hard block removed. If that refactor has already landed,
   this item is a no-op verification; if these phases run first, defer
   B3 to it rather than re-deciding here.
4. **Dual contracts (B6).** Remove or consolidate the
   `make_simple_attachment_contract` `equipment_*` contracts that
   register a second writable surface at the same table path as the rich
   slice contract, so each table path has one validated write surface.
5. **God-method validator (B7).** Refactor
   `validate_document_references` to drive per-table validation from
   `iter_table_contracts()` + `field_registry` instead of repeated
   hand-written per-table stanzas. Single-source the heat-pump tag/FK
   invariants currently duplicated between `document.py` and
   `heat_pumps/service.py`.
6. **Orphaned config (B8).** Resolve
   `thermal_bridges.simulation_file_asset_ids` - either add the matching
   row column or remove the registry entry. Decide whether attachment
   fields should keep being modeled as `long_text` FieldDefs or move to a
   dedicated attachment field type, and align with the Phase 01 reference
   validation.
7. **Tests.** Cover converged data-shapes (one type/storage for
   `inside_outside` and `phase`), the chosen identifier-uniqueness rule
   on every table, single-write-surface per path, and the contract-driven
   validator producing the same results as before for valid documents.

## Acceptance Criteria

- `inside_outside` and `phase` each have one field type and one storage
  tier across all tables, with migrations where storage changed and
  existing documents still loading.
- Identifier uniqueness behaves the same on every table and the rule is
  recorded in `data-table.md`.
- Each table path has exactly one validated write surface; the
  `equipment_*` simple contracts are gone or merged.
- `validate_document_references` is contract-driven; heat-pump invariants
  have one definition.
- No orphaned attachment registry entries remain.
- Focused backend (and any affected frontend) tests pass.

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
- `backend/features/project_document/tables/attachments.py`
- `backend/features/heat_pumps/service.py`
- `frontend/src/features/equipment/components/HotWaterTanksTable.tsx`
- `frontend/src/features/equipment/types.ts`
- `backend/tests/test_project_document.py`
