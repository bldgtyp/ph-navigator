---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Done
AUTHOR: Codex
SCOPE: Expose manageable Rooms Floor/Zone options after guardrails exist.
RELATED:
  - ../PLAN.md
  - ./phase-01-api-guardrails.md
---

# Phase 02 - Rooms Affordance

## Goal

Expose manage-options for Rooms `Floor` and `Zone` using the shared DataTable
field-config surface.

## Result

Complete.

## Scope

- Removed only the `"options"` lock from Rooms `Floor` and `Zone` overlay.
- Kept `"field_type"`, `"delete"`, and `"duplicate"` locked.
- Protected fields such as `status` remain locked by the Phase 01 shared
  mutability guardrails.
- Option-list edits dispatch through typed `editFieldBundle.nextOptions`.
- Existing shared modal behavior supports add, rename, reorder, recolor,
  color-code toggle, and unused-option delete.

## Explicit Deferral

Referenced-option replacement UX is deferred to Phase 03. For this phase,
nullable Rooms referenced deletes may clear cells through the typed backend path.

## Tests

- Header menu opens field-config modal for Rooms `Floor`.
- Header menu opens field-config modal for Rooms `Zone`.
- Add option dispatches through the bundle path and appears in the option list
  request.
- Rename/reorder/recolor are handled by the same full-list modal request and
  preserve row references by id.
- Protected `status` remains unavailable through Phase 01 guardrails.

## Verification

- `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
- `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
- `pnpm vitest run src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
- `pnpm exec tsc -b`
- `pnpm exec prettier --check src/features/equipment/lib.ts src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx`

## Exit Criteria

- Rooms users can curate Floor/Zone vocabularies without developer intervention.
- No protected single-select option list becomes user-editable.
