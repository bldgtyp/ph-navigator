---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Backend pilot for enabling custom-field schema mutations on Pumps.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/PRD.md; planning/features/equipment-custom-fields/PLAN.md; backend/features/project_document/tables/pumps.py; backend/features/project_document/tables/rooms.py
---

# Phase 01 - Backend Registry Pilot

## Goal

Make `pumps` the first non-Rooms Equipment table that actually supports
user-defined custom-field schema mutations through the generic
`custom-fields:mutate` endpoint.

Pumps is the right pilot because it already had a nearly complete
`pumps_field_registry`, but deliberately rejected schema mutation and
published `field_registry=None`. It also exercises the two hazards the
rollout must handle later: attachment core fields and inverse-link
display columns.

## Starting Context

- `backend/features/project_document/drafts.py` rejects any table whose
  contract has no `custom_fields` / `field_registry` capability with
  `custom_field_unsupported_table`.
- `backend/features/project_document/tables/rooms.py` is the canonical
  working pattern.
- `backend/features/project_document/tables/pumps.py` already defines:
  - `pumps_field_registry`
  - field-def accessors
  - row `custom_values` accessors
  - row `custom_links` accessors
  - built-in option-list helpers
  - formula field readers
- `pumps_field_registry.apply_schema_mutation` now points at
  `_apply_pumps_schema_mutation`.
- `pumps_field_registry.validate_schema_mutation` now points at
  `_validate_pumps_schema_mutation`.
- `pumps_contract.field_registry` now publishes `pumps_field_registry`.

## Implementation Tasks

- [x] Replace the Pumps rejection helper with Rooms-style apply / validate
   wrappers:
   - `_apply_pumps_schema_mutation(...)`
   - `_validate_pumps_schema_mutation(...)`
   - lazy-import `apply_schema_mutation` and `validate_schema_mutation`
     from `features.project_document.schema_mutations`
   - pass `capability=pumps_field_registry`
- [x] Set `pumps_field_registry.apply_schema_mutation` and
   `validate_schema_mutation` to the real wrappers.
- [x] Publish `pumps_field_registry` on `pumps_contract.field_registry`.
- [x] Confirm Pumps built-in physical fields stay built-in and locked by
   the existing frontend overlays. Do not add inverse-link columns to
   backend `field_defs`; they are computed display columns.
- [x] Add focused backend tests for:
   - `addField` on `pumps` succeeds and returns an updated slice with a
     new `cf_*` field in `field_defs`
   - duplicate display-name rejection still applies across built-in and
     custom fields
   - `mutation.table_key != path table_name` still rejects
   - custom value writes to the new Pumps field survive table replace /
     refetch paths, if a convenient fixture already exists
   - attachment field behavior is unchanged for `datasheet_asset_ids`
- [x] Run only focused backend tests during the phase. Leave repo-wide
   gates for Phase 04 unless the implementation touches shared mutation
   behavior.

## Completion Evidence

- `backend/features/project_document/tables/pumps.py` now delegates
  schema mutations through `apply_schema_mutation` /
  `validate_schema_mutation` with `capability=pumps_field_registry`.
- `pumps_contract.field_registry` now publishes `pumps_field_registry`.
- `backend/tests/test_project_document_pumps.py` covers registry
  exposure, `addField` round trip, built-in duplicate-name rejection,
  path/payload table mismatch rejection, and custom value plus
  `datasheet_asset_ids` replace/refetch behavior.
- `cd backend && uv run ruff check tests/test_project_document_pumps.py features/project_document/tables/pumps.py` - passed.
- `cd backend && uv run pytest tests/test_project_document_pumps.py` - passed, 8 tests.
- `$simplify` pass completed; only stale module-docstring wording was
  flagged and fixed.

## Files To Inspect First

- `backend/features/project_document/tables/rooms.py`
- `backend/features/project_document/tables/pumps.py`
- `backend/features/project_document/tables/contracts.py`
- `backend/features/project_document/schema_mutations.py`
- `backend/features/project_document/mutations/dispatcher.py`
- relevant backend tests under `backend/tests/`

## Acceptance Criteria

- [x] `POST /draft/tables/pumps/custom-fields:mutate` no longer returns
  `custom_field_unsupported_table` for valid editor requests.
- [x] A valid `addField` mutation appends or inserts a custom Pumps
  `TableFieldDef` without changing PHN-defined core fields.
- [x] Existing Pumps replace, option-list, attachment, and inverse-link
  read behavior remains unchanged.
- [x] Focused backend tests pass.

## Handoff Notes

Pumps backend custom-field mutation support is green, but frontend
add-field button wiring remains intentionally out of this phase. Phase
02 should roll backend support across the remaining target tables
before Phase 03 exposes the UI affordance.

## Stop Condition

Phase 01 stopped after the Pumps backend pilot was implemented and
focused backend tests passed. `STATUS.md` records the test commands and
results; Phase 02 has not started.
