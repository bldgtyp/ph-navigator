---
DATE: 2026-06-29
TIME: 18:56 EDT
STATUS: Phase 01 and Phase 03 setup implemented locally; production run held.
AUTHOR: Codex
SCOPE: Phase plan for production-safe frontend performance testing.
RELATED:
  - planning/refactor/production-frontend-performance/README.md
  - planning/refactor/production-frontend-performance/PRD.md
  - planning/refactor/production-frontend-performance/STATUS.md
  - planning/refactor/production-frontend-performance/phases/phase-00-credentials-and-access.md
---

# Production Frontend Performance Plan

## Current Execution Boundary

Phase 01 and Phase 03 are implemented locally. The next allowed live action is
running the guarded production fixture setup command in the production API
environment. The authenticated production performance matrix remains held until
Ed explicitly approves that run after `PERF_PROJECT_ID` is known.

## Phase 00 - Credentials And Access Decisions

Goal: decide exactly what account/project/observability access is allowed before
any authenticated production test runs.

Tasks:

1. Choose whether the first authenticated run is read-only only.
2. Create or identify a dedicated production test account.
3. Choose an approved production project id for read-only traversal.
4. Decide whether a disposable production project is allowed for write-path
   timing.
5. Decide whether browser-side metrics are sufficient or whether Render
   read-only metrics/logs are needed.
6. Record the decision in `STATUS.md` and the first scorecard.

Verification:

- No secrets are written to the repo.
- The chosen account does not invalidate Ed's personal session.
- The chosen project scope is explicit.

## Phase 01 - Production Harness Guards

Goal: make the perf matrix safe to point at `https://www.ph-nav.com` before
using the approved production testing account/project.

Status: implemented locally. See
`phases/phase-01-production-harness-guards.md`.

Tasks:

1. In `frontend/tests/e2e/perf/perf-matrix.spec.ts`, derive API response
   capture origin from `E2E_API_BASE_URL`, or infer `https://api.ph-nav.com`
   when `E2E_BASE_URL=https://www.ph-nav.com`.
2. Add production target detection for `ph-nav.com`.
3. Fail fast unless `PHN_PERF_PRODUCTION=1` is present for production.
4. Add `PHN_PERF_READONLY=1` scenario branches for Spaces and Equipment.
5. In read-only mode, replace mutating cell edits with non-mutating table
   interactions.
6. Require `PHN_PERF_ALLOW_PRODUCTION_WRITES=1` for production mutation paths.
7. Keep the existing local `make e2e-perf` behavior unchanged.

Verification:

- Local `make e2e-perf PERF_PROJECT_ID=<local-id>` still works.
- Production URL without `PHN_PERF_PRODUCTION=1` fails before login.
- Production read-only mode does not call table write endpoints.
- Production write mode cannot start without the explicit write flag.

## Phase 02 - Public Anonymous Baseline

Goal: record a credential-free production shell scorecard.

Tasks:

1. Run public readiness/header checks:
   - `curl -fsS https://api.ph-nav.com/api/v1/ready`
   - `curl -I https://www.ph-nav.com`
   - `curl -I https://ph-nav.com`
2. Use Playwright or browser tooling to load the sign-in page from a cold
   browser context.
3. Capture navigation timing, LCP, long tasks, static JS/CSS resources,
   cache headers, and redirect behavior.
4. Record cold and warm behavior separately if cache state differs.
5. Create a dated scorecard under this refactor folder.

Verification:

- No credentials used.
- Scorecard records exact command, timestamp, browser, viewport, and network
  conditions.

## Phase 03 - Production Fixture Setup

Goal: create or reset the approved `PERF-STRESS` fixture for
`codex@testing.com`.

Status: guarded setup path implemented locally. See
`phases/phase-03-production-fixture-setup.md`. The production command has not
been run.

Tasks:

1. Implement a production-safe fixture setup path, preferably a guarded backend
   one-off command run in the `ph-navigator-api` Render environment.
2. Require explicit confirmation flags before touching production, for example
   `--confirm-production`.
3. Create or repair the `codex@testing.com` testing account without storing the
   password in repo artifacts.
4. Create or reset the `PERF-STRESS` fixture in place.
5. Seed 250 rows per relevant table. If separate knobs exist, set both
   `table_rows=250` and `equipment_rows=250`.
6. Include Climate, Envelope, and Apertures fixture data.
7. Leave 3D Model data absent for the first production run.
8. Print the resulting project id for use as `PERF_PROJECT_ID`.

Verification:

- Existing local seed guards remain intact.
- The command cannot run in production without explicit confirmation.
- The same fixture project id is reused across formal runs unless the fixture
  must be recreated for a documented reason.
- No secrets or reset links are written into tracked files.

## Phase 04 - Authenticated Read-Only Baseline

Goal: run the full route matrix on production against the seeded testing
fixture, initially without mutating data.

Tasks:

1. Use `codex@testing.com`.
2. Use the approved `PERF-STRESS` fixture project id.
3. Run the guarded read-only matrix:

```bash
cd frontend
E2E_BASE_URL=https://www.ph-nav.com \
E2E_API_BASE_URL=https://api.ph-nav.com \
E2E_EMAIL=<approved-production-test-email> \
E2E_PASSWORD=<approved-production-test-password> \
PERF_PROJECT_ID=<approved-production-project-id> \
PHN_PERF=1 \
PHN_PERF_PRODUCTION=1 \
PHN_PERF_READONLY=1 \
pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts
```

4. Save Playwright JSON artifacts under the normal gitignored test-results
   path.
5. Summarize the run into a dated scorecard in this folder.

Verification:

- No write endpoints are called.
- No production secrets appear in command logs or scorecards.
- Every route row records whether route content was representative or empty.

## Phase 05 - Optional Fixture Write Baseline

Goal: measure real production write-path performance only if Ed approves a
write-enabled run inside the seeded fixture/disposable project.

Tasks:

1. Reset and identify `PERF-STRESS`.
2. Confirm the testing account has only the access needed to mutate that project.
3. Run the production matrix with writes enabled only for scoped edit rows.
4. Record all written fields and resulting project state.
5. Execute the approved teardown or retention plan.

Verification:

- The run cannot touch real project data.
- Scorecard lists project id, write scope, and cleanup outcome.
- Any write-path finding is compared against the archived local stress baseline
  with production network/DB latency called out separately.

## Phase 06 - Triage And Budget Decisions

Goal: decide whether any production finding should become implementation work
or a future budget gate.

Tasks:

1. Rank findings by user impact and implementation ease.
2. Separate frontend payload/runtime findings from backend/API latency findings.
3. Decide whether to open a follow-up refactor for any measured issue.
4. Decide whether any metric should become a check, budget, or recurring smoke.
5. Fold durable testing guidance into `context/PRODUCTION_DEPLOYMENT.md` or
   `context/DEVELOPMENT_WORKFLOW.md` only after the first production run proves
   the workflow.

Verification:

- No fix is proposed without scorecard evidence.
- Any new budget has a calibrated production baseline.
