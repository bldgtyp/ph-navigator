---
DATE: 2026-06-29
TIME: 17:24 EDT
STATUS: Planned - production performance run design captured; full perf matrix not run yet.
AUTHOR: Codex
SCOPE: Adapt the archived local frontend performance eval to the live production
  deployment at `https://www.ph-nav.com` / `https://api.ph-nav.com`, decide what
  can be reused, and define the first safe production performance scorecard.
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/README.md
  - planning/archive/dated/2026-06-25/frontend-perf/PLAN.md
  - planning/archive/dated/2026-06-25/frontend-perf/STATUS.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md
  - context/PRODUCTION_DEPLOYMENT.md
  - frontend/tests/e2e/perf/perf-matrix.spec.ts
  - backend/scripts/seed_perf_stress_fixture.py
---

# Production Frontend Performance Review Plan - 2026-06-29

## Executive Summary

The archived `frontend-perf` packet is still the right starting point for
methodology: keep the three-layer model (payload, runtime/load, render), fixed
page matrix, dated scorecards, and thresholds. The production run needs a
different harness boundary because production is live infrastructure, has no
active staging stack, and uses real accounts/projects/data.

Do **not** run the current `make e2e-perf` target directly against production
without a deliberate production fixture. The test currently assumes local
`codex@example.com` credentials, `PERF_PROJECT_ID`, `localhost:8000` API response
capture, dev-only React Profiler instrumentation, and mutating cell edits on
Spaces / Equipment. Those assumptions were safe for the local stress fixture;
they are not automatically safe on `www.ph-nav.com`.

## Current Production Target

Canonical production endpoints from `context/PRODUCTION_DEPLOYMENT.md`:

- Frontend: `https://www.ph-nav.com`
- Apex redirect: `https://ph-nav.com` -> `https://www.ph-nav.com/`
- API: `https://api.ph-nav.com`
- Runtime MCP: `https://api.ph-nav.com/mcp`
- Production object store: private R2 bucket `ph-navigator-prod`
- Render services: `ph-navigator-web`, `ph-navigator-api`, `ph-navigator-db`
- No active staging stack after the 2026-06-28 cleanup.

Safe public smoke captured before writing this plan:

| Check | Result |
|---|---|
| `curl -fsS https://api.ph-nav.com/api/v1/ready` | `200`, `status:"ok"`, `db:true`, `db_ms:3.16`, `requests_waiting:0` |
| `curl -I https://www.ph-nav.com` | `200`, Cloudflare/Render response, `last-modified: Mon, 29 Jun 2026 16:50:45 UTC` |
| `curl -I https://ph-nav.com` | `301` to `https://www.ph-nav.com/` |

## What To Reuse From The Archived Setup

Reuse as-is:

- The scorecard shape: page, tier, route chunk, LCP, key interaction duration,
  long tasks, render commits where available, largest API payload, flags.
- The page matrix and routes: dashboard, status, spaces, equipment, apertures,
  envelope, climate, model, materials catalog, frame types catalog, glazing
  types catalog.
- Browser-side metrics from `frontend/tests/e2e/perf/perf-matrix.spec.ts`:
  navigation timing, `largest-contentful-paint`, long-task observer reset before
  each scripted interaction, resource timing, and JSON attachments.
- `E2E_BASE_URL`, already supported by `frontend/playwright.config.ts`, for
  pointing Playwright at `https://www.ph-nav.com`.
- `E2E_API_BASE_URL`, already supported by `frontend/tests/e2e/_helpers.ts`, for
  API helper calls to `https://api.ph-nav.com`.
- Payload analysis as a local build check with `cd frontend && pnpm run analyze`.
  This measures the committed production bundle shape for the current checkout,
  not the already-deployed static artifact, but it remains the best source for
  route/chunk ownership.
- The final archived baselines:
  - Main JS chunk after route splitting: ~94.10 kB gzip.
  - Model route shell after split: 7.00 kB gzip.
  - Active 3D stage: ~345.06 kB gzip.
  - Spaces stress edit after Phase 04A/04B: ~1.46-1.50 s, 23 commits.
  - Equipment Pumps stress edit after Phase 04A/04B: ~1.57-1.65 s, 22 commits.

Reuse with edits:

- `frontend/tests/e2e/perf/perf-matrix.spec.ts`
  - Replace the hard-coded `response.url().startsWith("http://localhost:8000/")`
    filter with an API origin derived from `E2E_API_BASE_URL`, or infer
    `https://api.ph-nav.com` when `E2E_BASE_URL=https://www.ph-nav.com`.
  - Add a read-only production mode for authenticated runs:
    `PHN_PERF_PRODUCTION=1` plus `PHN_PERF_READONLY=1`.
  - In read-only mode, replace Spaces / Equipment cell edits with hover, sort,
    filter, open-menu, tab-switch, or scroll interactions that do not write.
  - In write mode, require an explicit disposable production project id and
    credentials that Ed has approved for test mutation.
- `make e2e-perf`
  - Keep the local target unchanged.
  - Add a separate command or documented one-off for production so the live
    endpoint is never targeted accidentally.
- Scorecard naming
  - New production scorecards should live beside this review as
    `production-frontend-scorecard-YYYY-MM-DD.md`, not in the archived
    `frontend-perf` folder.

Do not reuse directly:

- `backend/scripts/seed_perf_stress_fixture.py` against production. It calls
  `assert_local_dev_database()` and intentionally creates/resets a local
  `PERF-STRESS` project with 1000 table rows and 250 equipment rows. That guard
  is correct and should stay.
- `react-scan` / `VITE_REACT_SCAN=true` for live production. It is dev-only and
  should not be shipped or enabled on `www.ph-nav.com`.
- Root React Profiler commit counts on the deployed static site. The profiler is
  gated by `import.meta.env.DEV` in `frontend/src/main.tsx`, so production builds
  will not populate `window.__PHN_REACT_PROFILER__`. Production render analysis
  should use Chrome trace / DevTools first, then reproduce locally with profiler
  if a live symptom needs component attribution.

## Production Run Modes

### Mode A - Public Anonymous Baseline

Safe to run immediately, no credentials:

- `curl` readiness and header checks from `context/PRODUCTION_DEPLOYMENT.md`.
- Playwright navigation to `/sign-in`, `/`, and any public redirect paths.
- Browser resource timing for static app shell JS/CSS/image transfer sizes.
- Lighthouse or Chrome trace for the sign-in page.

Output: public-shell scorecard row with TTFB, LCP, long tasks, JS/CSS transfer,
cache headers, and redirect behavior.

### Mode B - Authenticated Read-Only Production Baseline

Run after Ed provides/approves a production test account and project:

- `E2E_BASE_URL=https://www.ph-nav.com`
- `E2E_API_BASE_URL=https://api.ph-nav.com`
- `E2E_EMAIL=<approved production test account>`
- `E2E_PASSWORD=<approved production test password or one-time session setup>`
- `PERF_PROJECT_ID=<approved production project id>`
- `PHN_PERF=1`
- `PHN_PERF_PRODUCTION=1`
- `PHN_PERF_READONLY=1`

Scenarios:

- Dashboard: load and hover/open approved project card.
- Status: load and hover status content.
- Spaces / Equipment / catalog tables: sort, filter, open header menu, scroll,
  and hover cells. No cell commits.
- Apertures / Envelope / Model: canvas drag/orbit only if the approved project
  has relevant data; otherwise record the empty/normal state separately.
- Climate: load and switch/read existing source detail only.

Output: first comparable production route matrix without mutating data.

### Mode C - Authenticated Disposable-Project Write Baseline

Run only if Ed explicitly wants live write-path performance measured:

- Create a named disposable production project, for example
  `PERF-PROD-YYYYMMDD`.
- Document owner account, project id, allowed mutation scope, and teardown plan.
- Keep table sizes intentionally modest unless the purpose is to stress the live
  database.
- Run the current Spaces / Equipment edit scenarios only inside that disposable
  project.
- Record all writes and clean up or archive the project afterward.

Output: live table-edit scorecard comparable to the archived local stress rows,
with production network and Render DB latency included.

## Proposed First Production Scorecard

Create `planning/code-reviews/2026-06-29/production-frontend-scorecard-2026-06-29.md`
after the first run.

Columns:

| Page | Mode | Route | LCP | Key interaction | Long tasks > 50 ms | JS/CSS transfer | Largest API payload | API count | Render commits | Flags |
|---|---|---|---:|---:|---:|---:|---|---:|---:|---|

Notes:

- `Render commits` should be `n/a` for deployed production unless a production
  profiling build is intentionally created. Do not compare production `n/a`
  against the local 22-23 commit stress rows as if it were a measured win.
- `JS/CSS transfer` should come from browser resource timing on the deployed
  asset URLs. Local `pnpm run analyze` can explain ownership, but production
  transfer is the source for user-facing payload.
- Record cold and warm loads separately if Cloudflare/Render cache status
  differs.
- Include `cf-cache-status`, `age`, and Render/API response timing where visible.

## First Implementation Tasks Before Running Mode B/C

1. Patch `frontend/tests/e2e/perf/perf-matrix.spec.ts` to derive API origin
   instead of matching only `http://localhost:8000/`.
2. Add `PHN_PERF_READONLY=1` branches for Spaces and Equipment scenarios so
   production read-only can run without cell commits.
3. Add a production guard: if `E2E_BASE_URL` contains `ph-nav.com` and
   `PHN_PERF_PRODUCTION !== "1"`, fail fast with a clear error.
4. Add a second guard: if production mode is active and read-only mode is false,
   require `PHN_PERF_ALLOW_PRODUCTION_WRITES=1`.
5. Write the production scorecard template before running, then paste exact
   command, account/project scope, and artifact paths after the run.

## Suggested Commands

Public anonymous baseline:

```bash
curl -fsS https://api.ph-nav.com/api/v1/ready
curl -I https://www.ph-nav.com
curl -I https://ph-nav.com
```

Local payload ownership for the deployed commit, run from the matching checkout:

```bash
cd frontend
pnpm run analyze
```

Authenticated read-only production matrix, after harness guards exist and Ed
approves account/project scope:

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

## Open Questions

- Which production account should own the first read-only performance run?
- Which production project is approved for read-only page traversal?
- Do we want a disposable production project for write-path timing, or should
  write-path perf remain local/staging-only until a staging stack is recreated?
- Should production performance evidence include a Lighthouse run from a stable
  network profile, or is Playwright browser timing enough for this first pass?
- Should any production result become a budget gate, or is this only a dated
  observational scorecard for now?

## Recommendation

Run Mode A now/whenever needed, then do Mode B after the perf harness has the
production guards and read-only scenario branches. Defer Mode C unless the live
app shows a table-edit symptom that cannot be understood from local stress
fixtures plus production read-only network timing.
