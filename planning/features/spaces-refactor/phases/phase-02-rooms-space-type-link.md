---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Backend Rooms single-link FieldDef to Space-Types plus inverse
  Rooms link overlay on Space-Types.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - backend/features/project_document/tables/rooms.py
  - backend/features/project_document/inverse_view.py
  - backend/tests/test_project_document_record_linking_rollups.py
---

# Phase 02 - Rooms Space-Type Link

## Goal

Add a built-in Rooms linked-record field targeting Space-Types and make
the existing inverse-link system expose incoming Rooms links on the
Space-Types table.

## Preconditions

- Phase 01 is complete.
- `space_types` has a registered table path of `("space_types",)`.

## Tasks

1. Add a Rooms built-in FieldDef:
   - field key: `space_type_id`
   - display name: `Space Type`
   - field type: `linked_record`
   - config: `{ "target_table_path": ["space_types"], "max_links": 1 }`
2. Ensure existing documents forward-fill the Rooms `space_type_id`
   FieldDef when needed.
3. Confirm `validate_linked_record_field_defs` accepts built-in
   linked-record fields, not only `cf_*` fields. Patch validation if it
   assumes linked-record means custom-only.
4. Confirm `validate_rows_custom_links` accepts `custom_links` entries
   for built-in `space_type_id`.
5. Decide target-delete behavior. Preferred implementation: when a
   Space-Type row is deleted, clear `custom_links.space_type_id` from
   affected Rooms and emit/update a warning path consistent with
   existing table cascade behavior.
6. Expose inverse overlay on Space-Types using
   `build_inverse_table_view(body, ("space_types",))`.
7. Add backend tests proving:
   - Rooms can link to one Space-Type;
   - two links in `space_type_id` are rejected;
   - links to missing Space-Type ids are rejected;
   - Space-Types response shows inverse Rooms metadata and row ids;
   - deleting a Space-Type clears or blocks Room links according to the
     chosen behavior.

## Acceptance Criteria

- Rooms persisted data stores the selected Space-Type id in
  `custom_links.space_type_id`.
- A Room can link to zero or one Space-Type.
- A Space-Type response can identify every Room that links to it.
- Existing Rooms custom-field behavior still passes focused regression
  tests.

## Stop Conditions

- Stop if built-in `linked_record` fields break formula registry or
  field-schema mutation invariants.
- Stop if inverse-link metadata cannot distinguish the built-in Rooms
  `Space Type` link from user-created linked-record fields.

## File Entry Points

- `backend/features/project_document/tables/rooms.py`
- `backend/features/project_document/tables/space_types.py`
- `backend/features/project_document/_validators.py`
- `backend/features/project_document/inverse_view.py`
- `backend/tests/test_project_document_record_linking_rollups.py`
