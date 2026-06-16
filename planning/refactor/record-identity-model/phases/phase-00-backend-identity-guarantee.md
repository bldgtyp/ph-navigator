---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Planned
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
DataTable, and remove the only hard constraint on a user-facing label
(Heat Pumps). No user-visible change except that Heat Pumps stops
rejecting duplicate tags.

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
   than adding per-table stanzas.
2. Confirm the heat-pump tables keep their hidden-id uniqueness check
   (they already validate ids), but **remove** the user-facing label
   ("tag") uniqueness enforcement: delete the "Duplicate tag within
   table" rejection (`heat_pumps/service.py:225`) and any mirrored check
   in the document-level heat-pump validator.
3. Verify the existing non-blocking duplicate warning chip
   (`recordId.ts` / `GridBody.tsx`) is the only signal for duplicate
   user-facing labels, on every table.
4. Compatibility check: run the new universal id guard against real saved
   documents/drafts to confirm no pre-existing `row.id` collisions exist;
   if any do, decide repair-on-read vs reject and document it.
5. Tests:
   - duplicate `row.id` within a table is rejected on every table;
   - a duplicate user-facing label is accepted (no hard error) on every
     table, including Heat Pumps;
   - existing documents still load.

## Acceptance Criteria

- Every project DataTable enforces `row.id` uniqueness.
- No table hard-blocks a duplicate user-facing label; the Heat Pumps
  "Duplicate tag within table" error is gone.
- Existing saved documents still load.
- Focused backend tests pass.

## Stop Conditions

- Stop if real saved documents contain duplicate `row.id` values that
  cannot be repaired safely; design the repair/migration before enabling
  the guard on the load path.
- Stop if removing the HP label constraint breaks a downstream consumer
  that assumed unique HP tags (e.g. an export keyed by tag); find and fix
  that assumption first.

## File Entry Points

- `backend/features/project_document/_validators.py`
- `backend/features/project_document/document.py`
- `backend/features/project_document/tables/registry.py`
- `backend/features/heat_pumps/service.py`
- `backend/tests/test_project_document.py`
