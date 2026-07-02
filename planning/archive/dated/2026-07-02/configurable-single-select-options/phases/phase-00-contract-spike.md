---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Done
AUTHOR: Codex
SCOPE: Decision pass before implementation.
RELATED:
  - ../decisions.md
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../reviews/2026-07-02-critical-feature-review.md
---

# Phase 00 - Contract Spike

## Goal

Resolve the option-mutability contract before touching UI or backend behavior.

## Result

Complete. See `../decisions.md`.

## Questions To Answer

1. Use explicit `option_mutability = "editable" | "locked"`.
2. Backend enforcement is
   `TableFieldRegistry.option_editable_builtin_field_keys`, an allowlist for
   built-in single-select option edits. Custom `cf_*` single-selects remain
   editable.
3. Rooms `Floor` and `Zone` use nullable delete-to-clear behavior.
4. Inline create and paste-created options are disabled for locked option lists.
5. Rooms manage-options dispatches through typed `editFieldBundle.nextOptions`
   into `apply_edit_options`; do not add new `legacyOptions` wiring.

## Investigation Targets

- `frontend/src/shared/ui/data-table/types.ts`
- `frontend/src/shared/ui/data-table/components/SingleSelectPopover.tsx`
- `frontend/src/shared/ui/data-table/components/FieldConfigSectionOptions.tsx`
- `frontend/src/shared/ui/data-table/feature/useCustomFieldHandlers.ts`
- `frontend/src/features/equipment/lib.ts`
- `backend/features/project_document/mutations/options_ops.py`
- `backend/features/project_document/tables/contracts.py`
- `backend/features/project_document/tables/rooms.py`

## Deliverables

- Decision entry in `../decisions.md`.
- PRD acceptance criteria updated for nullable Rooms delete-to-clear.
- Phase 01 scope updated with exact backend/frontend contract names.

## Exit Criteria

- A reviewer can state which fields are option-editable and why:
  custom `cf_*` single-selects and allowlisted built-ins only.
- A direct REST/MCP mutation against protected `status` has an expected result:
  `422 custom_field_options_locked`.
- Inline create and paste behavior for locked fields is specified: reject
  unknown labels instead of creating options.
- Rooms in-use delete behavior is specified: nullable cells clear.
