---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Backend document schema and registered table-slice support for
  the new Space-Types table.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - backend/features/project_document/document.py
  - backend/features/project_document/rows.py
  - backend/features/project_document/tables/registry.py
  - backend/features/project_document/tables/rooms.py
---

# Phase 01 - Backend Space-Types Table

## Goal

Add `tables.space_types` as a first-class project-document DataTable
with an empty default row set and two user-facing fields: Tag and Name.

## Preconditions

- Current checkout has the FieldDef-capable table infrastructure
  (`field_defs`, `custom_values`, `custom_links`) working for Rooms and
  equipment tables.
- Current checkout has generic table-slice endpoints using registered
  `TableContract`s.

## Tasks

1. Add `SpaceTypeRow` and `SpaceTypesTableEnvelope` in
   `backend/features/project_document/rows.py`.
2. Add `space_types: SpaceTypesTableEnvelope` to
   `ProjectDocumentTables` in
   `backend/features/project_document/document.py`.
3. Add a typed-column key set for Space-Types. Preferred minimal shape:
   `id` as typed column, `record_id` and `name` in `custom_values`.
4. Create `backend/features/project_document/tables/space_types.py`
   following the Rooms/Pumps table-contract pattern.
5. Seed built-in FieldDefs:
   - `record_id`, display `Tag`, `short_text`, primary identifier.
   - `name`, display `Name`, `short_text`.
6. Register `space_types_contract` in
   `backend/features/project_document/tables/registry.py`.
7. Add table-slice response/extract/diff support, including
   `field_defs`, `rows`, `rows_computed`, `inverse_links`, and
   `inverse_link_fields`.
8. Decide and implement schema-version handling for existing documents.
   Expected path: bump document schema version and migrate
   `project_versions` / `project_version_drafts` JSON to add empty
   `tables.space_types`.
9. Add backend tests proving:
   - new empty project documents include `tables.space_types`;
   - no default Space-Type rows are seeded;
   - Tag/Name FieldDefs are present;
   - duplicate non-empty Tags are rejected;
   - generic table-slice fetch/replace works for `space_types`.

## Acceptance Criteria

- `GET /api/v1/projects/:projectId/versions/:versionId/document/tables/space_types`
  returns an empty Space-Types slice for a saved new project.
- `GET /api/v1/projects/:projectId/versions/:versionId/draft/tables/space_types`
  returns the draft Space-Types slice for an editable version.
- Replacing the Space-Types slice can add/edit/delete rows.
- `Tag` uniqueness is enforced case-insensitively after trim.
- Existing project documents can still be loaded after migration.
- Focused backend tests pass.

## Stop Conditions

- Stop if existing saved documents cannot be migrated or read safely.
- Stop if the table contract requires table-specific branches in routes
  or services that would bypass the registry pattern.

## File Entry Points

- `backend/features/project_document/rows.py`
- `backend/features/project_document/document.py`
- `backend/features/project_document/tables/space_types.py`
- `backend/features/project_document/tables/registry.py`
- `backend/tests/test_project_document.py`
- `backend/tests/test_project_document_schema_mutation_endpoint.py`
