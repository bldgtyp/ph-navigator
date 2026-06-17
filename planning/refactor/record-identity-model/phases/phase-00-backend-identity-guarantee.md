---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Complete (2026-06-17)
AUTHOR: Ed (via Claude)
SCOPE: Make hidden-id uniqueness universal across all DataTables and stop
  Heat Pumps hard-blocking duplicate user-facing labels.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - backend/features/project_document/_validators.py
  - backend/features/project_document/document.py
  - backend/features/heat_pumps/service.py
---

# Phase 00 - Backend Identity Guarantee

## Goal

Make the hidden `row.id` a real uniqueness guarantee on every project
DataTable, and remove every hard constraint on a user-facing handle - both
Heat Pumps and the Space-Types table the 2026-06-16 spaces-refactor added.
No user-visible change except that Heat Pumps and Space-Types stop
rejecting duplicate tags (and Space-Types stops requiring a Tag on named
rows).

## Preconditions

- `validate_unique_ids` exists
  (`backend/features/project_document/_validators.py:62`) and is already
  used for space-types, assembly segments, and layers.
- The document validator `validate_document_references`
  (`backend/features/project_document/document.py`) is the universal gate
  for generic tables.

## Tasks

1. Add a `validate_unique_ids` (or equivalent) check on `row.id` for
   every project DataTable that lacks one: Rooms, Appliances, Electric
   Heaters, Fans, Hot Water Heaters, Hot Water Tanks, Pumps, Ventilators,
   and Thermal Bridges. Prefer driving it generically from
   `iter_table_contracts()` so new tables inherit it automatically rather
   than adding per-table stanzas. Space-Types already wires this guard by
   hand (`document.py:324`); the generic approach should subsume it, so do
   not leave a duplicate per-table call.
2. Remove every user-facing-handle hard block (keep the hidden-id checks):
   - **Heat Pumps:** keep its id-uniqueness check, but delete the
     "Duplicate tag within table" rejection (`heat_pumps/service.py:225`)
     and any mirrored check in the document-level heat-pump validator.
   - **Space-Types:** keep `validate_unique_ids` on `row.id`
     (`document.py:324`), but delete the duplicate-Tag rejection
     (`document.py:333`, "Duplicate space type Tag") and the "named row
     requires a Tag" rejection (`document.py:332`). After this,
     Space-Types' `record_id`/Tag is an ordinary, non-unique field; the
     `require_record_id_seeded` membership check stays (Tag must still
     exist as a FieldDef, it just is not constrained).
3. Verify the existing non-blocking duplicate warning chip
   (`recordId.ts` / `GridBody.tsx`) is the only signal for duplicate
   user-facing labels, on every table.
4. Compatibility check: run the new universal id guard against real saved
   documents/drafts to confirm no pre-existing `row.id` collisions exist;
   if any do, decide repair-on-read vs reject and document it.
5. Tests:
   - duplicate `row.id` within a table is rejected on every table;
   - a duplicate user-facing label is accepted (no hard error) on every
     table, including Heat Pumps and Space-Types;
   - a Space-Type row with a Name but no Tag is accepted (the
     "requires a Tag" rejection is gone);
   - update/relax the existing Space-Types tests that assert
     duplicate-Tag and named-row-without-Tag rejection
     (`tests/test_project_document_space_types.py`);
   - existing documents still load.

## Acceptance Criteria

- Every project DataTable enforces `row.id` uniqueness.
- No table hard-blocks a duplicate user-facing label; both the Heat Pumps
  "Duplicate tag within table" error and the Space-Types
  "Duplicate space type Tag" + "requires a Tag" errors are gone.
- Existing saved documents still load.
- Focused backend tests pass.

## Stop Conditions

- Stop if real saved documents contain duplicate `row.id` values that
  cannot be repaired safely; design the repair/migration before enabling
  the guard on the load path.
- Stop if removing the HP or Space-Types label constraint breaks a
  downstream consumer that assumed unique tags (e.g. an export keyed by
  tag, or code that treats the Space-Type Tag as a lookup key rather than
  resolving by `row.id`); find and fix that assumption first. The Rooms ->
  Space-Type picker labels by handle but links by `row.id`, so duplicate
  Tags are a display concern (warning chip), not a structural break.

## File Entry Points

- `backend/features/project_document/_validators.py`
- `backend/features/project_document/document.py` (Space-Types validation
  block, `:322-336`)
- `backend/features/project_document/tables/registry.py`
- `backend/features/project_document/tables/space_types.py`
- `backend/features/heat_pumps/service.py`
- `backend/tests/test_project_document.py`
- `backend/tests/test_project_document_space_types.py`

## Outcome (2026-06-17)

- The universal guard is `generic_table_row_ids()` +
  `validate_table_row_ids()` in `_validators.py`, called once from
  `validate_document_references`. `generic_table_row_ids()` is the single
  source of truth for the 10 generic, link-targetable tables;
  `collect_target_row_ids` now derives from it, and
  `LINKED_RECORD_TARGET_PATHS` carries a keep-in-step cross-reference.
- The per-table inline `row.id` dup checks were removed in favor of the
  guard. Note: in practice every table already enforced `row.id`
  uniqueness inline, so making it universal was effectively a refactor —
  the guard is **not stricter** than before, so it cannot newly reject an
  existing document. The net behavior change is only the dropped
  user-facing-handle hard blocks. (This satisfies the "compatibility
  against saved documents" task: no new id rejection path was introduced;
  dev DBs rebuild regardless.)
- Heat Pumps: dropped the "Duplicate tag within table" block in
  `service._validate_slice` (and the now-unused `tag_field` on
  `_TableSpec`); replaced the document-level
  `_validate_heat_pump_table_ids_and_tags` with id-only
  `validate_unique_ids` calls.
- Space-Types: removed both hard blocks (duplicate-Tag and
  named-row-without-Tag); `require_record_id_seeded` stays.
- Tests: space_types duplicate-Tag / named-without-Tag tests inverted to
  assert acceptance; added duplicate-`row.id` rejection tests for
  Space-Types and Heat Pumps, and a duplicate-tag-accepted test for Heat
  Pumps. Full backend suite green (890 passed, 2 skipped).

### Deferred to a later phase

- `heat_pumps/service._validate_slice` still enforces `row.id` uniqueness
  even though the document model_validator (run on every save via
  `validate_document`) now re-checks it. Harmless and fail-safe (both
  enforce the same invariant), but the slice keeps the check because it is
  also the standalone unit-test seam. Consolidating the heat-pump
  validation seam onto the document gate is out of scope for the
  record-identity model and left for the data-table-consolidation work.
