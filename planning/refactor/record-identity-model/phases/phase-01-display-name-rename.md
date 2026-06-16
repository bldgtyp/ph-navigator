---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Rename the pinned identifier label from "Tag"/"Record-ID" to
  "Display Name" across all tables, with a conditional forward-fill
  migration that preserves user renames.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - backend/features/project_document/tables/
  - backend/features/project_document/custom_fields.py
  - frontend/src/features/equipment/components/
---

# Phase 01 - Display Name Rename And Migration

## Goal

Make the pinned identifier column read **Display Name** on every table,
in newly created documents and in existing saved ones, without
overwriting any label a user has intentionally renamed.

## Preconditions

- Phase 00 complete (hidden-id guard universal; no label hard blocks).
- Schema-version policy decided (PRD open question 3).
- Confirmed: built-in `display_name` is persisted in `envelope.field_defs`
  (`tables/_registry_helpers.py:71-73`,
  `custom_fields.py:204`), so a migration is required.

## Tasks

1. Update the `record_id` FieldDef seed `display_name` to "Display Name"
   in every table seed: `tables/rooms.py:120` ("Record-ID"),
   `appliances.py`, `electric_heaters.py`, `fans.py`,
   `hot_water_heaters.py`, `hot_water_tanks.py`, `pumps.py`,
   `ventilators.py`, `thermal_bridges.py`, `space_types.py` (all "Tag").
2. Write a **conditional forward-fill migration** over
   `project_versions` and `project_version_drafts`: for each table's
   `record_id` FieldDef, set `display_name` to "Display Name" **only**
   when the current value is exactly the old default ("Tag" or
   "Record-ID"); leave any other (user-renamed) value untouched.
3. Update frontend fallback labels that hardcode the old default. The
   generic tables read the server `display_name`, but several column
   builders fall back to a literal `?? "Tag"` / `?? "Record-ID"` when the
   FieldDef is absent (e.g. equipment `*Table.tsx`,
   `ThermalBridgesTable.tsx`); change those fallbacks to "Display Name".
4. Confirm the heat-pump frontend label (it builds FieldDefs client-side)
   reads "Display Name" for its identifier column, or is updated to.
5. Tests:
   - new documents seed the `record_id` label as "Display Name";
   - the migration rewrites a default "Tag"/"Record-ID" label to
     "Display Name";
   - the migration does NOT rewrite a user-renamed label;
   - frontend renders "Display Name" as the pinned header on every table;
   - existing documents load after migration.

## Acceptance Criteria

- The pinned identifier column reads "Display Name" on every table in new
  and migrated documents.
- User-renamed identifier labels are preserved through the migration.
- No frontend fallback still hardcodes "Tag" / "Record-ID" for the
  identifier column.
- Existing saved documents load; focused frontend and backend tests pass.

## Stop Conditions

- Stop if the migration cannot reliably distinguish a default label from
  a user-renamed one (e.g. a user legitimately named their column
  "Tag"); design the detection (e.g. only rewrite when value equals the
  prior seed default for that table) and confirm before running.
- Stop if the rename requires a schema-version bump that has downstream
  effects not yet scoped; resolve the versioning decision first.

## File Entry Points

- `backend/features/project_document/tables/*.py`
- `backend/migrations/` (or the project's Alembic migration path)
- `backend/features/project_document/custom_fields.py`
- `frontend/src/features/equipment/components/*Table.tsx`
- `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx`
- `frontend/src/features/equipment/heat-pumps/*-columns.tsx`
- `backend/tests/test_project_document.py`
