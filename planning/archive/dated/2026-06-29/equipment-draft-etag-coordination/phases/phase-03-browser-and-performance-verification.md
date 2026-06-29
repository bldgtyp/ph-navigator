---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Manual/browser verification and performance guard for the stale ETag fix.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 03 - Browser And Performance Verification

## Goal

Verify the user-visible bug is fixed without undoing the frontend performance
work that avoided eager inactive-table refetches.

## Browser Smoke

Use the repo baseline:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Login: `codex@example.com` / `password`

Smoke the reported flow:

1. Open an editable project.
2. Open `Equipment / Fans`.
3. Add a Fan with enough visible data to prove persistence.
4. Do not `Save Version`.
5. Open `Equipment / Hot-water tanks`.
6. Add a Hot Water Tank.
7. Confirm:
   - no draft-conflict banner;
   - Hot Water Tank row appears;
   - the top bar still shows uncommitted changes;
   - Fan row remains present if returning to Fans.

Smoke at least one more pair:

- `Pumps -> Appliances`, or
- heat-pump leaf pair if P01 touched heat-pump controllers.

## Network Guard

During the first write, inspect network calls or Playwright request logs:

- accepted table `PUT` should occur;
- source table cache should update from the mutation response;
- sibling table queries may be invalidated;
- sibling table `GET`s should not fan out immediately across every mounted
  inactive Equipment table.

During the second write:

- the target sibling table may issue one fresh `GET`;
- the target sibling `PUT` should use the latest `draft_etag`;
- no `409 draft_etag_mismatch` should occur.

## Performance Guard

If P01 changes invalidation/refetch behavior, rerun the focused frontend perf
target used by the June 25 work:

```bash
cd frontend && PHN_PERF=1 PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts
```

If the fixture project is unavailable, document that and use network request
counts from the new draft-ETag e2e spec as the minimum guard.

## Exit Criteria

- ✅ Reported workflow passes in the browser.
- ✅ New e2e spec passes.
- ✅ Network evidence shows target-only refresh before second write.
- ✅ No eager refetch fan-out returns.
- ✅ `STATUS.md` records exact verification commands and results.

## Verification

Recorded 2026-06-29 17:51 EDT.

The default `localhost:5173` dev server was serving the Dropbox checkout, so
P03 used a temporary worktree Vite server:

```bash
cd frontend && VITE_API_BASE_URL=http://localhost:8000 pnpm exec vite --host 127.0.0.1 --port 3000 --strictPort
```

The browser base URL must be `http://localhost:3000`, not
`http://127.0.0.1:3000`, so the local auth cookie path matches the existing
e2e setup.

```bash
make format
# passed

cd frontend && pnpm exec tsc --noEmit --pretty false
# passed

cd frontend && pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.tsx src/features/project_document/table-slice.test.ts src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx
# 3 files passed, 13 tests passed

cd frontend && E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:8000 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag
# 2 passed
```

The focused e2e spec now records draft table request method, table key, order,
and response status. For both `Fans -> Hot-water tanks` and
`Pumps -> Appliances`, it asserts:

- the source table `PUT` is accepted;
- no inactive Equipment sibling table issues a `GET` after the source write;
- the target table issues exactly one fresh `GET` before its `PUT`;
- no draft table response returns `409`;
- the target row persists in the draft API response.

The older perf-matrix command was attempted:

```bash
cd frontend && PHN_PERF=1 PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498 E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:8000 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts
```

It did not produce usable route timings in this local DB: the dashboard case
timed out waiting for `PERF-STRESS - Frontend Perf Stress Fixture`, and
project-route cases failed their ready-region assertions. The new
draft-ETag e2e request guard is therefore the P03 minimum performance guard.
