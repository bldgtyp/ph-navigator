---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Backend pilot for enabling custom-field schema mutations on Pumps.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/PRD.md; planning/features/equipment-custom-fields/PLAN.md; backend/features/project_document/tables/pumps.py; backend/features/project_document/tables/rooms.py
---

# Phase 01 - Backend Registry Pilot

## Goal

Make `pumps` the first non-Rooms Equipment table that actually supports
user-defined custom-field schema mutations through the generic
`custom-fields:mutate` endpoint.

Pumps is the right pilot because it already has a nearly complete
`pumps_field_registry`, but deliberately rejects schema mutation and
publishes `field_registry=None`. It also exercises the two hazards the
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
- `pumps_field_registry.apply_schema_mutation` currently points at
  `_reject_pumps_schema_mutation`.
- `pumps_contract.field_registry` is currently `None`.

## Implementation Tasks

1. Replace the Pumps rejection helper with Rooms-style apply / validate
   wrappers:
   - `_apply_pumps_schema_mutation(...)`
   - `_validate_pumps_schema_mutation(...)`
   - lazy-import `apply_schema_mutation` and `validate_schema_mutation`
     from `features.project_document.schema_mutations`
   - pass `capability=pumps_field_registry`
2. Set `pumps_field_registry.apply_schema_mutation` and
   `validate_schema_mutation` to the real wrappers.
3. Publish `pumps_field_registry` on `pumps_contract.field_registry`.
4. Confirm Pumps built-in physical fields stay built-in and locked by
   the existing frontend overlays. Do not add inverse-link columns to
   backend `field_defs`; they are computed display columns.
5. Add focused backend tests for:
   - `addField` on `pumps` succeeds and returns an updated slice with a
     new `cf_*` field in `field_defs`
   - duplicate display-name rejection still applies across built-in and
     custom fields
   - `mutation.table_key != path table_name` still rejects
   - custom value writes to the new Pumps field survive table replace /
     refetch paths, if a convenient fixture already exists
   - attachment field behavior is unchanged for `datasheet_asset_ids`
6. Run only focused backend tests during the phase. Leave repo-wide
   gates for Phase 04 unless the implementation touches shared mutation
   behavior.

## Files To Inspect First

- `backend/features/project_document/tables/rooms.py`
- `backend/features/project_document/tables/pumps.py`
- `backend/features/project_document/tables/contracts.py`
- `backend/features/project_document/schema_mutations.py`
- `backend/features/project_document/mutations/dispatcher.py`
- relevant backend tests under `backend/tests/`

## Acceptance Criteria

- `POST /draft/tables/pumps/custom-fields:mutate` no longer returns
  `custom_field_unsupported_table` for valid editor requests.
- A valid `addField` mutation appends or inserts a custom Pumps
  `TableFieldDef` without changing PHN-defined core fields.
- Existing Pumps replace, option-list, attachment, and inverse-link
  read behavior remains unchanged.
- Focused backend tests pass.

## Handoff Notes

Do not wire the Pumps frontend add-field button in this phase unless
the backend pilot is already green. Keeping the UI disabled until the
backend accepts schema mutations prevents a visible submit failure.

## Stop Condition

Stop after the Pumps backend pilot is implemented and focused backend
tests pass. Update `STATUS.md` with test commands and results before
starting Phase 02.
