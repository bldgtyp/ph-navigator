---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Decision pass before implementation.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../reviews/2026-07-02-critical-feature-review.md
---

# Phase 00 - Contract Spike

## Goal

Resolve the option-mutability contract before touching UI or backend behavior.

## Questions To Answer

1. Is `FieldDef.locked: ["options"]` the product-facing source of truth, or do
   we add an explicit `option_editable` / `option_mutability` concept?
2. What is the backend enforcement surface: per-table allowlist, per-table lock
   set, or persisted schema metadata?
3. Do Rooms `Floor` and `Zone` use current nullable delete-to-clear behavior, or
   do in-use deletes require replacement?
4. Should inline create and paste-created options be disabled for locked option
   lists?
5. Does Rooms manage-options dispatch through typed `editOptions` /
   `editFieldBundle`, or continue using legacy whole-table replace
   `legacyOptions`?

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

- Decision entry in `decisions.md` or this phase file.
- Updated PRD acceptance criteria if delete semantics change.
- Updated Phase 01 scope with exact backend/frontend contract names.

## Exit Criteria

- A reviewer can state which fields are option-editable and why.
- A direct REST/MCP mutation against protected `status` has an expected result.
- Inline create and paste behavior for locked fields is specified.
- Rooms in-use delete behavior is specified.
