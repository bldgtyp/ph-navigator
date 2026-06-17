---
DATE: 2026-06-17
TIME: 11:57 EDT
STATUS: Complete - covered by Phase 06 full CI/browser closeout
AUTHOR: Ed (via Claude)
SCOPE: Close backend validation gaps - attachment asset-id references,
  heat-pump single-select option-id references, and numeric range checks.
RELATED:
  - planning/archive/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - backend/features/project_document/document.py
  - backend/features/project_document/_validators.py
  - backend/features/assets/registry.py
  - backend/features/heat_pumps/service.py
---

# Phase 01 - Backend Validation Hardening

## Goal

Make the backend reject invalid data-shapes uniformly: attachment
asset-id arrays must reference assets that exist and belong to the
project, heat-pump single-select option-id references must exist in their
option lists, and numeric fields must respect consistent ranges. This is
the highest-severity correctness/security work (review B1, B2, B4),
including the public-repo data-hygiene control against cross-project
asset references.

## Preconditions

- Asset policy declarations exist in
  `backend/features/assets/registry.py` (`ATTACHMENT_FIELDS`).
- The document validator `validate_document_references`
  (`backend/features/project_document/document.py`) is the universal gate
  for generic tables.
- A decision on enforcement strictness (reject-on-write vs
  strip-and-warn) per PRD open question 5; default reject-on-write to
  match the existing linked-record cascade behavior.

## Tasks

1. [x] **Attachment reference validation (B1).** In the document validator,
   validate every `*_asset_ids` array (`datasheet_asset_ids`,
   `pdf_report_asset_ids`, `photo_asset_ids`, heat-pump datasheets)
   against `project_assets`:
   - asset exists and belongs to the same project;
   - asset kind matches the field's declared `asset_kind`;
   - count respects `max_count` from `ATTACHMENT_FIELDS`.
   Drive this from the `ATTACHMENT_FIELDS` registry so it covers all
   tables, not per-table stanzas.
2. [x] **Heat-pump option-id validation (B2).** Validate
   `heat_pumps.manufacturer/system_family/refrigerant/model_type/
   install_type` references on heat-pump rows against their option lists,
   matching how generic tables validate built-in and custom selects.
   Ensure heat-pump option keys participate in the document's
   `single_select_options` defaults / setdefault path so absence-vs-empty
   semantics match the other tables.
3. [x] **Numeric range checks (B4).** Apply consistent non-negativity /
   domain ranges to equipment numerics (volts, wattage, quantity,
   horse_power, flow rates) via the custom-value coercion path; align the
   generic equipment tables with the non-negativity heat-pump rows
   already enforce. (The `phase ∈ {1,3}` reconciliation is part of
   Phase 04 because it is tied to the data-shape decision.)
4. [x] **Migration/compat check.** Verify the new validation does not break
   loading existing saved documents/drafts; if pre-existing invalid
   references exist, apply the chosen strip-and-warn-on-read or
   reject-on-write policy consistently and document it.
5. [x] **Tests.** Add backend tests proving (with synthetic ids only):
   - asset ids that do not exist / belong to another project / wrong kind
     are rejected on every table's write path;
   - heat-pump option-id references that are not in the list are rejected;
   - numeric out-of-range values are rejected;
   - valid writes still succeed and existing documents still load.

## Acceptance Criteria

- [x] No write path accepts an attachment asset id that is missing, belongs
  to another project, or violates kind/count.
- [x] Heat-pump single-select option references are validated against their
  option lists, matching generic tables.
- [x] Equipment numerics enforce consistent ranges across tables.
- [x] Existing saved documents still load under the chosen compatibility
  policy.
- [x] Focused backend tests pass.

## Implementation Notes

- Added `backend/features/assets/reference_validation.py` as the
  repository-aware attachment reference gate. The pure
  `ProjectDocumentV1` validator still owns document-local invariants;
  asset existence, project ownership, kind/content policy, and max-count
  checks run in service-layer write paths where a database connection is
  already available.
- `replace_table_slice`, `save_draft`, `save_draft_as`, and heat-pump
  row patch writes now call the attachment validator before persisting.
  Read/load paths remain tolerant; the policy is strict reject-on-write.
- Extended `ATTACHMENT_FIELDS` / `iter_rows_for_table` to include all
  four heat-pump datasheet-bearing sub-tables.
- Heat-pump option keys now participate in document
  `single_select_options` setdefault, and heat-pump row option-id values
  are checked against those lists.
- Generic equipment numeric built-ins now enforce non-negative values
  for shipped fields such as `quantity`, `volts`, `wattage`,
  `horse_power`, flow/airflow, runtime, capacity, efficiency, and hot
  water tank heat-loss values. `power_factor` is bounded to 0..1.
- Corrected the backend hot-water-heater seed label from `Temperatur` to
  `Temperature`; the frontend typo fix from Phase 00 was otherwise
  vulnerable to being reintroduced by backend table responses.

## Simplify Outcome

- Reuse / quality / efficiency reviewers found actionable cleanup, all
  fixed before commit:
  - batch same-project asset lookups and dump the document once per
    asset-reference scan;
  - reject pending/failed assets with the existing
    `asset_upload_incomplete` envelope;
  - report field-policy failures as `asset_mime_not_allowed`, matching
    the attachment service;
  - move direct project-asset test inserts to
    `backend/tests/builders/assets.py`;
  - remove the duplicate hot-water-tank heat-loss check;
  - precompute Heat Pump option-id sets once per document validation.

## Verification

- Docs-pass updated `context/technical-requirements/data-table.md` so
  the stable attachment field contract records reject-on-write backend
  validation for missing, incomplete, cross-project, policy-invalid, and
  over-count asset ids.
- `cd backend && uv run pytest tests/test_assets_service.py tests/features/heat_pumps/test_heat_pumps.py tests/test_project_document_pumps.py`
  passed: 27 tests.
- `cd backend && uv run ruff check features/assets/reference_validation.py features/assets/registry.py features/project_document/document.py features/project_document/_validators.py features/project_document/drafts.py features/heat_pumps/service.py tests/test_assets_service.py tests/features/heat_pumps/test_heat_pumps.py tests/test_project_document_pumps.py`
  initially reported import ordering only; `ruff check --fix` corrected
  it, and the same focused pytest command passed again.
- After simplify fixes, the focused Ruff command passed including
  `backend/tests/builders/assets.py`, and the same focused pytest group
  passed again.
- Full `make ci` was intentionally held for Phase 06; Phase 06 later passed full CI.
- Browser smoke not applicable for this backend validation phase.

## Stop Conditions

- Stop if enforcing references would reject a meaningful number of real
  saved documents; escalate the strict-vs-lenient policy decision before
  enabling on the load path.
- Stop if asset ownership cannot be determined at validation time without
  a repository call that the validator is not allowed to make; design the
  ownership check at the correct layer (service vs validator) first.

## File Entry Points

- `backend/features/project_document/document.py`
- `backend/features/project_document/_validators.py`
- `backend/features/project_document/custom_fields.py`
- `backend/features/assets/registry.py`
- `backend/features/heat_pumps/service.py`
- `backend/tests/test_project_document.py`
- `backend/tests/test_project_document_record_linking_rollups.py`
