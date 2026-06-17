---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Complete - archived
AUTHOR: Ed (via Codex)
SCOPE: Implementation sequence for Spaces, Space-Types, Rooms link field,
  reverse-link UI, and closeout.
RELATED:
  - planning/archive/spaces-refactor/PRD.md
  - planning/archive/spaces-refactor/phases/phase-01-backend-space-types-table.md
  - planning/archive/spaces-refactor/phases/phase-02-rooms-space-type-link.md
  - planning/archive/spaces-refactor/phases/phase-03-frontend-spaces-parent.md
  - planning/archive/spaces-refactor/phases/phase-04-frontend-table-link-ui.md
  - planning/archive/spaces-refactor/phases/phase-05-verification-docs-closeout.md
---

# Spaces Refactor - Plan

## Archive State

Implemented and verified through Phase 05, then archived on 2026-06-17.
This plan is historical; current durable behavior lives in `context/`
and the implementation.

## Existing Precedents

- Rooms is currently a top-level project tab in
  `frontend/src/features/projects/lib.ts` and is rendered by
  `frontend/src/features/projects/components/ProjectTabContent.tsx`.
- `RoomsPage` owns Rooms-specific linked-record wiring and currently
  hard-codes the Phase 1 target list to Pumps.
- Backend table contracts are registered in
  `backend/features/project_document/tables/registry.py`.
- Rooms' backend contract in
  `backend/features/project_document/tables/rooms.py` already exposes
  `field_defs`, formula overlays, custom links, and inverse-link
  overlays.
- The generic inverse-link engine lives in
  `backend/features/project_document/inverse_view.py` and should be
  reused for Space-Types.
- Record-linking tests exist in
  `backend/tests/test_project_document_record_linking_rollups.py`.

## Implementation Strategy

Do the data model before the UI rename. The UI can only render a real
Space-Types table and a Rooms picker once the backend has a registered
`space_types` table path, a table-slice response, and validation for
Rooms `space_type_id` links.

Phases are intentionally split so backend schema work can be verified
without fighting route churn, and route churn can be verified before
the linked-cell UI is polished.

## Cross-Cutting Risks

1. **Persisted FieldDefs.** Adding a built-in Rooms field is not only a
   frontend column change. Existing project documents need the Rooms
   `space_type_id` FieldDef inserted or forward-filled, otherwise older
   documents will not show the built-in link field.
2. **Schema version.** `ProjectDocumentV1.schema_version` is currently
   versioned. Adding `tables.space_types` and a built-in Rooms link
   likely warrants a schema-version bump plus migration for saved
   `project_versions` and `project_version_drafts`.
3. **Target table paths.** Linked records use canonical table paths,
   not labels. The planned target path is `["space_types"]`; do not
   use UI route names or `["spaces", "space-types"]` in persisted
   FieldDef config.
4. **Route compatibility.** Existing links to `/rooms` and existing
   Room focus/open flows need redirects. Heat-pump chips and other
   Rooms deep links should move to `/spaces/rooms`.
5. **Reverse link rendering.** Backend inverse overlays are generic,
   but frontend reverse-link columns still need table-specific row
   resolver data so pills can show Room identifiers and navigate.
6. **No seeded rows.** Empty Space-Types means tests must assert no
   default Hallway/Restroom/Apartment rows are created.

## Verification Summary

Each implementation phase should run focused tests for touched layers.
Final closeout requires:

1. `make format`
2. `make ci`
3. Browser smoke on `http://localhost:5173` with backend
   `http://localhost:8000`, signed in as `codex@example.com`
4. `graphify update .` after code changes
5. Context docs updated only after the behavior is verified
