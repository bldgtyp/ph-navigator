---
DATE: 2026-06-29
TIME: 17:49 EDT
STATUS: Implemented locally through Phase 03 setup path; production run held.
AUTHOR: Codex
SCOPE: Current state and handoff for production frontend performance testing.
RELATED:
  - planning/refactor/production-frontend-performance/README.md
  - planning/refactor/production-frontend-performance/PRD.md
  - planning/refactor/production-frontend-performance/PLAN.md
  - planning/refactor/production-frontend-performance/phases/phase-00-credentials-and-access.md
  - planning/refactor/production-frontend-performance/phases/phase-01-production-harness-guards.md
  - planning/refactor/production-frontend-performance/phases/phase-03-production-fixture-setup.md
  - planning/code-reviews/2026-06-29/production-frontend-performance-review-plan.md
---

# Production Frontend Performance Status

## Current State

Implemented locally through the safe setup steps. Ed approved the working path
of creating a dedicated production `testing` account and seeding that account
with disposable project data analogous to the local dev seed fixture.

Completed:

- Production guards added to `frontend/tests/e2e/perf/perf-matrix.spec.ts`.
- Read-only production branch added for Spaces and Equipment table scenarios.
- Production matrix excludes the Model route by default because the fixture has
  no 3D Model data.
- Guarded production fixture setup path added to
  `backend/scripts/seed_perf_stress_fixture.py`.
- Production fixture command documented in `backend/scripts/README.md`.
- Focused backend tests added in `backend/tests/test_seed_perf_stress_fixture.py`.

Not done:

- Production fixture command has not been run.
- Authenticated production performance matrix has not been run.
- Production write-path timing remains held.

## Evidence Reviewed

- Archived local perf packet at
  `planning/archive/dated/2026-06-25/frontend-perf/`.
- Production deployment runbook at `context/PRODUCTION_DEPLOYMENT.md`.
- Current perf matrix at `frontend/tests/e2e/perf/perf-matrix.spec.ts`.
- Current Playwright base URL support in `frontend/playwright.config.ts`.
- Existing API helper production URL support in `frontend/tests/e2e/_helpers.ts`.
- Local stress seed guard in `backend/scripts/seed_perf_stress_fixture.py`.
- Production fixture guard and reset path in
  `backend/scripts/seed_perf_stress_fixture.py`.
- Fixture guard tests in `backend/tests/test_seed_perf_stress_fixture.py`.
- Dev-only React Profiler gate in `frontend/src/main.tsx`.
- Public smoke on 2026-06-29:
  - `https://api.ph-nav.com/api/v1/ready` returned `200`, `db:true`,
    `db_ms:3.16`, `requests_waiting:0`.
  - `https://www.ph-nav.com` returned `200`.
  - `https://ph-nav.com` returned `301` to `https://www.ph-nav.com/`.

## Decisions So Far

- Keep the archived three-layer methodology: payload, runtime/load, render.
- Keep production scorecards under this refactor packet, not under the archived
  local perf folder.
- Do not run the current local `make e2e-perf` directly against production.
- Do not use local seed scripts against production.
- Treat production React commit counts as `n/a` unless a profiling build is
  explicitly created; the deployed app is not a dev build.
- Prefer a dedicated production test account over Ed's personal login.
- Use a dedicated production `testing` account with seeded fixture project data
  as the target for authenticated production performance runs.
- Production testing email: `codex@testing.com`.
- Fixture project name / BT number: `PERF-STRESS`.
- Fixture size: 250 rows per seeded table for the first production pass. If the
  fixture implementation keeps separate `table_rows` and `equipment_rows`
  knobs, set both to `250` unless a narrower equipment-specific pass is needed.
- Fixture data coverage: include Climate, Envelope, and Apertures. Do not
  include a 3D Model file in the first fixture.
- Reset policy: reset the same `PERF-STRESS` fixture in place before each
  formal run. Keep one stable `PERF_PROJECT_ID` for comparable scorecards and
  avoid accumulating dated production test projects.
- Production write-path timing may be measured only inside that seeded testing
  fixture/project, not against real client/project data.
- Direct DB and R2 credentials are not needed for this frontend perf packet.
- Production fixture setup should run inside the production API environment so
  it uses existing production environment configuration; do not create local
  production `.env` files.
- The setup command owns only the `codex@testing.com` / `PERF-STRESS` path.
- The setup command refuses alternate production account emails and alternate
  production BT numbers.
- Production route enumeration intentionally omits Model unless
  `PHN_PERF_INCLUDE_MODEL=1` is set for a future model-backed fixture.

## Credentials And Access Needed

Minimum for Phase 02 public baseline:

- No credentials.

Minimum for Phase 04 authenticated baseline:

- Dedicated production `testing` account email: `codex@testing.com`.
- Password or approved one-time login method supplied at run time, not stored.
- Seeded disposable production fixture project `PERF-STRESS` owned by or shared
  with that account.
- Approved `PERF_PROJECT_ID` for route traversal and optional scoped writes.
- Fixture shape: 250 seeded rows; include Climate, Envelope, and Apertures; do
  not include 3D Model data; reset the same fixture in place before each formal
  run.

Additional for Phase 05 optional write baseline:

- Explicit Ed approval to mutate the testing fixture project.
- Dedicated test account with Editor access only on that project.
- Disposable production project id/name: `PERF-STRESS`.
- Mutation scope and teardown/retention plan.
- Run window if production load/noise matters.

Optional observability:

- Render read-only dashboard or API access if backend/API latency correlation is
  needed.
- Cloudflare dashboard/API access only if edge/cache analytics are needed.

Not needed:

- Production database URL.
- R2 access key or secret.
- Fernet secret.
- Account token secret.
- Ed's personal session cookie.
- One-time invite/reset links committed to the repo.

## Open Questions

- What password should be assigned to `codex@testing.com` when the production
  setup command is run?
- Is browser-side timing enough for the first production scorecard, or should
  Render metrics/logs be correlated from the start?
- Should the first run be cold-cache only, warm-cache only, or both?

## Next Step

When Ed approves live setup, run the guarded fixture command in the production
API environment:

```bash
cd backend
uv run python -m scripts.seed_perf_stress_fixture \
  --confirm-production \
  --email codex@testing.com \
  --table-rows 250 \
  --equipment-rows 250
```

Use the printed `PERF_PROJECT_ID` for Phase 04. Hold the actual authenticated
performance run until explicitly approved.

## Verification So Far

- Docs planning packet created and updated for implementation.
- `planning/.instructions.md` read before adding planning material.
- Graphify queried for production/perf/planning context; direct source review
  provided the actionable details.
- Backend guard/fixture tests: `cd backend && uv run pytest tests/test_seed_perf_stress_fixture.py`
  passed, 4 tests.
- Backend ruff: `cd backend && uv run ruff check scripts/seed_perf_stress_fixture.py tests/test_seed_perf_stress_fixture.py`
  passed.
- Frontend TypeScript: `cd frontend && pnpm exec tsc -b --pretty false`
  passed.
- Frontend ESLint: `cd frontend && pnpm exec eslint tests/e2e/perf/perf-matrix.spec.ts`
  passed.
- Playwright dry listing for local target listed 11 routes.
- Playwright dry listing for production target listed 10 routes with Model
  excluded.
- `git diff --check` passed.
- No authenticated production testing performed.
