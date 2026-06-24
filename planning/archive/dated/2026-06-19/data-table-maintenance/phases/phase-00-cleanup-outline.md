---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Implemented
AUTHOR: Ed (via Codex)
SCOPE: Initial cleanup slice for deferred DataTable consolidation items.
RELATED:
  - planning/features/data-table-maintenance/README.md
  - planning/features/data-table-maintenance/STATUS.md
  - planning/archive/data-table-consolidation/phases/phase-06-verification-docs-closeout.md
---

# Phase 00 - Cleanup Outline

## Goal

Retire the two cleanup items extracted from DataTable consolidation
without changing user-visible table behavior.

## Tasks

1. [x] Split Heat Pump frontend support code so
   `frontend/src/features/equipment/heat-pumps/lib.ts` no longer needs a
   structural guard exception. `lib.ts` is now a 20-line barrel re-exporting
   six focused sibling modules: `row-builders.ts`, `payload-builders.ts`,
   `sorting.ts`, `tags.ts`, `option-helpers.ts`, `labels.ts`. Every helper
   keeps its original name/signature, so the `../lib` / `./lib` importers
   across the feature are unaffected.
2. [x] Split Heat Pump panel tests so
   `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
   no longer needs a structural guard exception. The render harness and
   fixtures moved to `__tests__/heatPumpsPanelHarness.tsx` (shared `fetchMock`
   exported); the spec file dropped from 834 to 393 lines.
3. [x] Extract backend document reference validation out of the current
   oversized `validate_document_references` path into narrower validators.
   Added `validate_generic_table` (the shared per-table sequence) and
   `validate_typed_option_refs` to `_validators.py`, plus private
   `_validate_min_zero` / `_validate_unit_fraction` range helpers on the
   document model. The orchestrator dropped from ~505 to ~320 lines and each
   table block is now: compute option-id sets → typed-option/range checks →
   one `validate_generic_table` call.
4. [x] Preserve existing error payloads. All `ValueError` messages are
   byte-for-byte identical (the new helpers take `str.format` templates that
   reproduce the original wording); the 536 focused validation tests pass
   unchanged.
5. [x] Run focused frontend/backend tests for touched areas (see Verification).

## Acceptance Criteria

- Size-exception comments added during DataTable consolidation are
  removed.
- Backend validator code is easier to scan and test without losing
  reject-on-write coverage.
- No DataTable route, row payload, schema fingerprint, or table-view
  endpoint contract changes.

## Verification

- Backend: `ruff check`, `ruff format --check`, and `ty check` clean on
  `document.py` + `_validators.py`; 536 focused validation/document/equipment
  tests pass (1 skipped). Full-suite DB-integration failures are pre-existing
  xdist-vs-shared-Postgres contention (each fails test passes when run alone)
  and are resolved by the serialized `make ci` migrate-then-test path.
- Frontend: `node scripts/check-file-sizes.mjs` exits 0 (no remaining
  `@size-exception` markers in the Heat Pump feature); the Heat Pump vitest
  suite and ESLint/Prettier pass on the split files.

## Notes

This is cleanup after a completed refactor, not a prerequisite for
DataTable consolidation closeout.

Behavior note: the per-table refactor preserves every validator's logic and
error wording. The only observable change is the *relative order* of
independent checks within a single table when a document holds multiple
simultaneous violations (e.g. a bad typed-option ref now raises before a bad
linked-record field-def for Rooms). No test asserts cross-violation ordering,
and single-violation behavior is unchanged.
