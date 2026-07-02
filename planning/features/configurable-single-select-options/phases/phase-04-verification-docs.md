---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Done
AUTHOR: Codex
SCOPE: Final verification and durable docs updates.
RELATED:
  - ../PLAN.md
  - ./phase-01-api-guardrails.md
  - ./phase-02-rooms-affordance.md
  - ./phase-03-cascade-ux.md
---

# Phase 04 - Verification and Docs

## Goal

Prove the feature is safe across shared DataTable paths and record the durable
contract outside the feature packet.

## Result

Complete.

## Verification

- Backend targeted tests verify allowlisted/protected option edits, nullable
  clear, replacement rewrites, and required replacement enforcement.
- Frontend unit tests verify FieldConfig option locking, SingleSelect popover
  create gating, paste unknown-label behavior, and cascade delete behavior.
- Browser smoke on Rooms verified:
  - add Floor option
  - add second Floor option and alphabetize order
  - delete unused Floor option
  - delete referenced Floor option with explicit clear behavior
  - add and rename Zone option
- Browser smoke on protected Pumps `status` verified:
  - option controls disabled in the field-config modal
  - no inline `+ Create` for an unknown status label
  - pasted unknown status label did not commit
  - no console warnings/errors

## Finding Fixed

Browser smoke found that generic Equipment `status` overlays lacked the
frontend `"options"` lock even though the backend rejected edits. Phase 04 added
`STATUS_OPTION_LOCK_OVERLAY` across shared Equipment status tables and covered
it with `lib.test.ts` / `PumpsTable.reuse.test.tsx`.

## Docs

- Updated `context/technical-requirements/data-table.md` with the final option
  mutability and cascade contract.
- Updated `STATUS.md` with exact tests and browser evidence.
- Phase notes remain in the feature packet until final archive.

## Commands

- `uv run pytest tests/test_project_document_phase_3_type_conversion.py`
- `uv run ruff check tests/test_project_document_phase_3_type_conversion.py`
- `pnpm vitest run src/features/equipment/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/shared/ui/data-table/__tests__/SingleSelectPopover.test.tsx src/shared/ui/data-table/__tests__/useGridEdit.test.ts src/shared/ui/data-table/__tests__/lib.test.ts`
- `pnpm exec tsc -b`
- `pnpm exec prettier --check src/features/equipment/lib.ts src/features/equipment/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`

## Exit Criteria

- The feature is not dependent on memory of this packet for future DataTable
  work.
- All protected/allowlisted semantics are covered by tests.
