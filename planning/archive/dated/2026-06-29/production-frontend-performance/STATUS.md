---
DATE: 2026-06-29
TIME: 18:56 EDT
STATUS: RESOLVED + ARCHIVED 2026-06-29. All actionable findings shipped — cache headers (PR #20), equipment table-views + draft-tables fan-out collapsed 7→1 (PRs #21, #22); climate map LCP accepted as expected. Phase 05 write-path intentionally never run. Historical record only.
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

- Phase 02 public anonymous baseline captured 2026-06-29; scorecard at
  `scorecards/2026-06-29-phase-02-public-baseline.md`. Headline: cold LCP
  764 ms / warm 104 ms, zero long tasks; all content-hashed static assets are
  served `cache-control: max-age=0`, so fonts (~53 KB) re-download on warm
  navigation — first Phase 06 candidate.
- Production fixture command password path now generates a strong password at
  run time and prints it once (`_resolve_production_password`), matching the
  Phase 00 decision; covered by `backend/tests/test_seed_perf_stress_fixture.py`.

- Phase 03 fixture run executed 2026-06-29 in the `ph-navigator-api` Render
  Shell; `codex@testing.com` / `PERF-STRESS` seeded and reset-in-place.
- Phase 04 authenticated read-only matrix captured 2026-06-29; scorecard at
  `scorecards/2026-06-29-phase-04-authenticated-readonly.md`. 10/10 routes
  passed in 48.1s, zero long tasks; outliers: climate LCP 1.9s (Leaflet map
  tile) and equipment 19 API requests (per-type table + table-views fan-out).

Not done:

- Phase 05 production write-path timing remains held (separate explicit
  approval required).
- Phase 06 triage/budget decisions not yet made.

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
- Production testing password: generated at run time, shown once, never stored
  in the repo.
- First-run metrics: browser-side timing only; Render correlation deferred.
- First-run cache coverage: both cold-cache and warm-cache, recorded separately.
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

All three launch-blocking questions are resolved (Ed, 2026-06-29):

- Password for `codex@testing.com`: generate a strong random password at run
  time, print it once, never store it in the repo. Ed retains it out of band.
- First scorecard metrics: browser-side timing only. Defer Render API
  correlation unless a route looks API-bound. No Render dashboard access needed
  for the first pass.
- Cache state: record both cold-cache and warm-cache separately.

## Next Step

Baselines and triage are done (see Phase 06 scorecard). The packet's remaining
work is three concrete follow-ups, each its own small change — not more
measurement runs.

## Next Actions (from Phase 06 triage)

1. **DONE (pending deploy):** `/assets/*` immutable cache headers added to
   `render.prod.yaml` + `render.yaml`, committed on branch
   `perf/asset-immutable-cache-headers` (`6a1cd939`); `main` not yet merged.
   Before deploy, validate with `render blueprints validate ./render.prod.yaml`
   and confirm Cloudflare isn't overriding `Cache-Control`. After deploy,
   re-run the Phase 02 public capture to confirm fonts no longer refetch warm.
2. **IN PROGRESS:** equipment fan-out investigation handed off to another agent;
   brief at `handoffs/step-2-equipment-fanout-investigation.md`. Open question:
   do the per-table `draft/tables/<type>` fetches duplicate the already-fetched
   full `…/draft` document? Decide frontend-dedupe vs batch `table-views`
   endpoint from the finding.
3. **CLOSED:** climate map LCP (~1.9 s) accepted as expected behavior (external
   Leaflet tile), no action — Ed, 2026-06-29. See Phase 06 triage Finding 3.

Re-run / re-measure helpers (fixture already seeded,
`PERF_PROJECT_ID = ce77af67-8994-4174-89d6-a59e3bd6189e`, password in Ed's
manager + session scratchpad):

```bash
# Authenticated read-only matrix (password from scratchpad file, not inline)
cd frontend
E2E_BASE_URL=https://www.ph-nav.com E2E_API_BASE_URL=https://api.ph-nav.com \
E2E_EMAIL=codex@testing.com E2E_PASSWORD="$(cat <scratchpad>/perf_pw)" \
PERF_PROJECT_ID=ce77af67-8994-4174-89d6-a59e3bd6189e \
PHN_PERF=1 PHN_PERF_PRODUCTION=1 PHN_PERF_READONLY=1 \
pnpm exec playwright test tests/e2e/perf/perf-matrix.spec.ts --reporter=line
```

Do not run:

- `make e2e-perf` against production.
- The production matrix without `PHN_PERF_PRODUCTION=1`.
- Fixture re-seed/writes outside `codex@testing.com` / `PERF-STRESS`.
- Write-path timing (Phase 05) without a separate explicit approval.

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
