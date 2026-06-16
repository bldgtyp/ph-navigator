---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Close backend validation gaps - attachment asset-id references,
  heat-pump single-select option-id references, and numeric range checks.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
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

1. **Attachment reference validation (B1).** In the document validator,
   validate every `*_asset_ids` array (`datasheet_asset_ids`,
   `pdf_report_asset_ids`, `photo_asset_ids`, heat-pump datasheets)
   against `project_assets`:
   - asset exists and belongs to the same project;
   - asset kind matches the field's declared `asset_kind`;
   - count respects `max_count` from `ATTACHMENT_FIELDS`.
   Drive this from the `ATTACHMENT_FIELDS` registry so it covers all
   tables, not per-table stanzas.
2. **Heat-pump option-id validation (B2).** Validate
   `heat_pumps.manufacturer/system_family/refrigerant/model_type/
   install_type` references on heat-pump rows against their option lists,
   matching how generic tables validate built-in and custom selects.
   Ensure heat-pump option keys participate in the document's
   `single_select_options` defaults / setdefault path so absence-vs-empty
   semantics match the other tables.
3. **Numeric range checks (B4).** Apply consistent non-negativity /
   domain ranges to equipment numerics (volts, wattage, quantity,
   horse_power, flow rates) via the custom-value coercion path; align the
   generic equipment tables with the non-negativity heat-pump rows
   already enforce. (The `phase ∈ {1,3}` reconciliation is part of
   Phase 04 because it is tied to the data-shape decision.)
4. **Migration/compat check.** Verify the new validation does not break
   loading existing saved documents/drafts; if pre-existing invalid
   references exist, apply the chosen strip-and-warn-on-read or
   reject-on-write policy consistently and document it.
5. **Tests.** Add backend tests proving (with synthetic ids only):
   - asset ids that do not exist / belong to another project / wrong kind
     are rejected on every table's write path;
   - heat-pump option-id references that are not in the list are rejected;
   - numeric out-of-range values are rejected;
   - valid writes still succeed and existing documents still load.

## Acceptance Criteria

- No write path accepts an attachment asset id that is missing, belongs
  to another project, or violates kind/count.
- Heat-pump single-select option references are validated against their
  option lists, matching generic tables.
- Equipment numerics enforce consistent ranges across tables.
- Existing saved documents still load under the chosen compatibility
  policy.
- Focused backend tests pass.

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
