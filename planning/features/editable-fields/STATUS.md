# Plan 31 Phase 3 Status — 2026-05-27

This note preserves the current Plan 31 Phase 3 frontend-bundle state
for the editable-fields worktree.

## Current Branch State

- Worktree used for this pass:
  `/Users/em/.codex/worktrees/e7ed/ph-navigator-v2`
- Branch:
  `codex/editable-fields-p2-6-frontend-fixtures`
- Working tree status:
  rebased onto `origin/main` at `97e3465`; implementation ready for
  review.

## Source-Of-Truth Docs

Resume from these docs:

- `planning/features/editable-fields/PRD.md`
- `planning/features/editable-fields/phases/phase-03-frontend-bundle.md`
- This handoff note

The bundle plan is still the canonical implementation tracker. This
status file records the exact branch-local progress and remaining
verification work.

## Phase 3 Frontend-Bundle Progress

The branch has landed the Phase 3 frontend-bundle slices through P2.6,
has local P2.7 verification evidence, and is rebased onto current
`origin/main`. The remaining phase-level work is merge/PR review.

P2.6 fixture rewrites covered:

- Added `frontend/src/features/equipment/testing/testFixtures.ts` as
  the shared v4 Rooms/Pumps test fixture source.
- Rewrote equipment table tests to use `field_defs`, `custom_values`,
  `record_id` built-in field defs, and custom `field_key` references.
- Added `backend/tests/project_document_helpers.py` for shared v4
  `field_defs` custom-field/fingerprint assertions.
- Rewrote project-document and data-table tests that still asserted
  `custom_fields`, row `.custom`, or typed mutable built-in columns.
- Rewrote backend project-document, MCP, default-fill, pumps, schema
  mutation, phase-1, phase-2, and phase-4 tests to the v4 envelope
  shape.
- Fixed `backend/features/mcp/helpers.py` so MCP custom-field helper
  responses read custom fields from `field_defs`.
- Added Playwright browser coverage for Rooms custom-field and Pumps
  built-in editable-field round-trip persistence.
- Fixed Pumps frontend row insert/delete/cell-write payload builders so
  they preserve `field_defs` during whole-table replaces.
- Post-rebase Simplify cleanup extracted `buildTableSchema()` as the
  shared production/test schema builder, made unsupported schema
  mutation fixture variants fail loudly, derived backend empty required
  table scaffolding from `empty_project_document()`, and hardened the
  Playwright custom-field cell target by resolving the column from the
  visible header.

## Current Gate Status

Repository gates are green after the P2.6 cleanup and P2.7 browser
evidence pass, rerun after rebasing onto `origin/main`:

- `make test`: backend 415 passed, 1 skipped; frontend 948 passed.
- `make lint`: backend Ruff and frontend ESLint clean.
- `make typecheck`: backend Ty and frontend TypeScript clean.
- `make smoke`: backend imports, DB check, frontend node smoke, and
  Docker Postgres health check clean.
- Playwright smoke: `cd frontend && E2E_BASE_URL=http://localhost:5174
  pnpm exec playwright test tests/e2e/editable-fields-roundtrip.spec.ts
  --project=chromium` passed on the worktree dev stack after the
  selector hardening.
- Formatters: backend Ruff format and frontend Prettier run on touched
  files.

Known residual noise:

- Backend tests emit existing FastAPI `HTTP_422_UNPROCESSABLE_ENTITY`
  deprecation warnings.
- Frontend tests emit existing React `act(...)` warnings in table view
  state/custom-field write tests.

P2.7 local verification is green. The branch has been rebased onto
`origin/main`; the full phase exit still requires merge/PR review.

## Verification Pattern For Each Fixture Rewrite

For backend test modules:

```bash
cd backend
uv run ruff check tests/<module>.py
uv run ty check tests/<module>.py
uv run pytest tests/<module>.py -q
```

For frontend test modules:

```bash
cd frontend
pnpm exec eslint <path>
pnpm exec vitest run <path>
```

Keep landing these as small module-sized commits. Do not mark the full
phase complete until the bundle has been rebased/merged to `origin/main`.
