---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete - P00-P03 implemented and verified; ready for archive.
AUTHOR: Codex
SCOPE: Current state, next step, blockers, and verification for the stale draft ETag fix.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - phases/
---

# Equipment Draft ETag Coordination - Status

## Current State

P00 reproduction/root-cause pass completed. P01 fresh target-slice write seam
implemented on branch. P02 focused unit/controller and Playwright regression
coverage added. P03 browser/network verification passed against the worktree
frontend on `localhost:3000`.

Root cause identified from current code:

- `frontend/src/features/equipment/routes/EquipmentPage.tsx` mounts all
  non-heat-pump Equipment slice queries at once.
- `frontend/src/features/project_document/table-slice.ts` invalidates sibling
  editor slices after an accepted write but suppresses active refetch via
  `refetchActiveSlices: false`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
  builds write payloads from the current `slice` prop and sends them without a
  target-slice freshness check.
- `backend/features/project_document/write_spine.py` correctly rejects stale
  draft guards with `409 draft_etag_mismatch`.

The bug appears to be a frontend cache-freshness regression, not a backend
concurrency policy bug.

## Phase 00 Evidence

Recorded 2026-06-29 17:25 EDT.

Reproduction mode: deterministic code/test harness and source-line evidence.
The local backend baseline was available and returned the expected signed-out
health response:

```bash
curl -i --max-time 3 http://localhost:8000/api/v1/auth/session
# HTTP/1.1 401 Unauthorized
# {"error_code":"not_authenticated", ...}
```

Root-cause evidence:

- `frontend/src/features/project_document/table-slice.ts:195-204` records the
  accepted table slice, marks the local draft touched with the accepted
  `draft_etag`, then invalidates sibling editor table slices with
  `refetchActiveSlices: false`.
- `frontend/src/features/project_document/table-slice.ts:251-254` maps that
  option to TanStack Query `refetchType: "none"`, so mounted sibling queries
  are stale but not refreshed.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:253-265`
  sends `replaceMutation` and typed schema mutations with `current: slice`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:282-339`
  builds cell, row insert/delete/duplicate, and legacy option replacement
  payloads from that same cached `slice` before mutation.
- `backend/features/project_document/write_spine.py:98-104` rejects a stale
  `If-Match` against the stored document-scoped `draft_etag` with
  `draft_etag_mismatch`.

Focused verification:

```bash
cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts
# ✓ src/features/project_document/table-slice.test.ts (5 tests)
```

That existing test includes the current performance assertion: an accepted
source-table write invalidates the sibling editor slice, does not actively
refetch it, and invalidates only the matching editor slice for the same
project/version.

## Next Step

Archive this completed packet under `planning/archive/dated/2026-06-29/`.

## Blockers

None for implementation planning.

Useful but not required until P03 browser verification:

- local dev backend/frontend running on `localhost:8000` / `localhost:5173`;
- project fixture with editable Equipment tables;
- `codex@example.com` / `password` login.

## Planned Verification

Focused tests after implementation:

- `cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts`
- controller-level Vitest coverage for fresh-slice payload construction;
- `cd frontend && pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag`
- `make format`

Broaden only if the implementation touches wider shared table behavior:

- `cd frontend && pnpm run test:e2e:tables`
- `make ci`

## Verification Performed

- Planning instructions read:
  `planning/.instructions.md` and `planning/features/.instructions.md`.
- Current root-cause code paths reviewed.
- `git diff --check` passed.
- Backend health baseline checked:
  `curl -i --max-time 3 http://localhost:8000/api/v1/auth/session`
  returned the expected signed-out `401 not_authenticated` response.
- Focused frontend test run:
  `cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts`
  passed with 5 tests.
- P01 typecheck:
  `cd frontend && pnpm exec tsc --noEmit --pretty false` passed.
- P01 focused frontend tests:
  `cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`
  passed with 11 tests.
- P02 typecheck:
  `cd frontend && pnpm exec tsc --noEmit --pretty false` passed.
- P02 focused frontend tests:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.tsx src/features/project_document/table-slice.test.ts src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`
  passed with 13 tests.
- P02 focused Playwright regression:
  `cd frontend && E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:8000 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag`
  passed with 2 tests against a temporary worktree Vite server on
  `localhost:3000`.
- P03 format:
  `make format` passed.
- P03 typecheck:
  `cd frontend && pnpm exec tsc --noEmit --pretty false` passed.
- P03 focused frontend tests:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.tsx src/features/project_document/table-slice.test.ts src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`
  passed with 13 tests.
- P03 focused Playwright browser/network regression:
  `cd frontend && E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:8000 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag`
  passed with 2 tests against the temporary worktree Vite server. The spec now
  asserts source-table writes do not cause eager inactive Equipment table
  `GET` fan-out, the target table performs exactly one fresh target `GET`
  before its `PUT`, and no draft table response returns `409`.
- P03 perf-matrix attempt:
  `cd frontend && PHN_PERF=1 PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498 E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:8000 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts`
  did not produce usable route timings in this local DB: the dashboard case
  timed out waiting for `PERF-STRESS - Frontend Perf Stress Fixture`, and
  project-route cases failed their ready-region assertions. Per P03, the
  passing draft-ETag request-count e2e is the minimum performance guard here.

## Notes

The likely regression source is the 2026-06-25 frontend performance phase that
changed sibling editor table handling from eager refetch to invalidation only.
That performance goal should stay intact; this packet should add write-time
freshness rather than restoring eager sibling refetch.
