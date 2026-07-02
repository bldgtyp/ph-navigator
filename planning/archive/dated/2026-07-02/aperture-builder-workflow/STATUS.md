---
DATE: 2026-07-02
TIME: 18:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current state for Aperture Builder workflow improvements.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS - Aperture Builder Workflow

## State

`Complete` - Phases 01-04 are implemented on
`codex/aperture-builder-workflow`. The Aperture Builder pick/paste machine now
moves directly from a valid Eyedropper source pick to paste-ready mode, removes
the dead intermediate `picked` mode, and keeps the Paint bucket toolbar button
highlighted/active while paste is armed. The persisted `flipLeftRight` command
now mirrors column widths, element column spans, left/right frame assignments,
and operation directions while preserving row spans and head/sill assignments.
Focused tests, full CI, graph refresh, and live browser smoke are complete.

## Next Step

Archive this completed feature packet under `planning/archive/dated/2026-07-02/`.

## Blockers

None known.

## Verification Ledger

- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/pick-paste-machine.test.ts src/features/apertures/__tests__/builder-store.test.ts src/features/apertures/__tests__/ApertureCanvasToolbar.test.tsx src/features/apertures/__tests__/ApertureCanvasContainer.test.tsx`
  - 2026-07-02 17:52 EDT: PASS (27 tests)
- `make ci`
  - 2026-07-02 17:55 EDT: PASS (backend 1264 passed / 7 skipped; frontend 223 files passed / 2052 tests; build passed). Existing lint warnings and React test `act(...)` warnings are unrelated to this phase.
- Phase 02 code inspection:
  - 2026-07-02 18:00 EDT: inspected `backend/features/envelope/commands/assemblies.py`, `backend/tests/envelope/test_envelope_commands_geometry.py`, `frontend/src/features/apertures/aperture-geometry.ts`, `frontend/src/features/apertures/operation-symbols.ts`, and aperture command models/dispatcher. No test run required for this docs-only phase.
- `cd backend && uv run pytest tests/test_project_document_apertures.py -k "flip_left_right"`
  - 2026-07-02 18:08 EDT: PASS (3 tests)
- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/AperturesTab.empty-state.test.tsx src/features/apertures/__tests__/ApertureCanvasToolbar.test.tsx src/features/apertures/__tests__/ApertureCanvasContainer.test.tsx`
  - 2026-07-02 18:08 EDT: PASS (16 tests)
- `cd backend && uv run ty check && uv run ruff check .`
  - 2026-07-02 18:09 EDT: PASS
- `cd frontend && pnpm run lint && pnpm exec tsc -b --pretty false`
  - 2026-07-02 18:09 EDT: PASS with existing 15 lint warnings only.
- Simplify pass:
  - 2026-07-02 18:09 EDT: fixed duplicated toolbar test fixture setup and included `flipLeftRight` in drift-report invalidation because the command swaps frame side slots.
- `make format`
  - 2026-07-02 18:10 EDT: PASS
- `graphify update .`
  - 2026-07-02 18:10 EDT: PASS (AST graph rebuilt; HTML viz skipped because the graph exceeds the 5000-node viz limit).
- `make ci`
  - 2026-07-02 18:12 EDT: PASS (backend 1267 passed / 7 skipped; frontend 223 files passed / 2054 tests; build passed). Existing lint, Recharts sizing, and React `act(...)` warnings remain unrelated.
- Browser smoke:
  - 2026-07-02 18:21 EDT: PASS via headless Playwright against local `make backend` (`:8000`) and `make frontend` (`:5173`) using `codex@example.com`. Restored the Codex fixture draft, verified Eyedropper source click arms paste mode and Paint bucket pressed state, posted `pasteAssignment` to a second element, exited paste mode with Escape, posted `flipLeftRight`, and verified the two canvas element hit targets reversed order. One initial 401 console entry occurred before sign-in and is expected.
