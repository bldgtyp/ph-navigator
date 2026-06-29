---
DATE: 2026-06-29
TIME: 17:25 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product and safety contract for production frontend performance testing.
RELATED:
  - planning/refactor/production-frontend-performance/README.md
  - planning/refactor/production-frontend-performance/PLAN.md
  - planning/refactor/production-frontend-performance/phases/phase-00-credentials-and-access.md
  - frontend/tests/e2e/perf/perf-matrix.spec.ts
  - context/PRODUCTION_DEPLOYMENT.md
---

# Production Frontend Performance PRD

## Problem

The local frontend performance harness was useful before launch: it measured
bundle payload, route runtime, API payloads, long tasks, and dev-only React
render commits against a seeded stress project. PH-Navigator is now live at
`https://www.ph-nav.com`, with the API at `https://api.ph-nav.com`, so the next
performance pass must measure the real deployed app without treating production
like local dev.

The current `make e2e-perf` target is not production-safe as-is:

- it assumes local `codex@example.com` / `password`,
- it requires a local `PERF_PROJECT_ID`,
- it filters API responses by `http://localhost:8000/`,
- it enables a React Profiler path that is dev-only,
- it mutates Spaces and Equipment cells.

## Requirements

### R1 - Keep Public Checks Credential-Free

Public production readiness and shell checks must not require account access.
They may include:

- `GET https://api.ph-nav.com/api/v1/ready`,
- `HEAD https://www.ph-nav.com`,
- `HEAD https://ph-nav.com`,
- browser navigation to sign-in and public redirects,
- static JS/CSS transfer timing,
- cache/header observations.

### R2 - Use Explicit Production Guards

The Playwright perf harness must fail fast when pointed at `ph-nav.com` unless
the caller opts into production testing.

Required guard shape:

- `PHN_PERF=1` still gates the perf suite.
- `PHN_PERF_PRODUCTION=1` is required when `E2E_BASE_URL` or
  `E2E_API_BASE_URL` targets `ph-nav.com`.
- `PHN_PERF_READONLY=1` is the default allowed production mode.
- `PHN_PERF_ALLOW_PRODUCTION_WRITES=1` is required for live mutation tests.

### R3 - Authenticated Read-Only Baseline Must Not Mutate Data

The first authenticated production matrix should use only read-only scenarios:

- load routes,
- hover stable controls,
- sort/filter/open table menus if those operations only affect client/view
  state,
- scroll tables,
- drag/orbit canvases without saving,
- inspect existing Model/Climate/Apertures/Envelope states when present.

Spaces and Equipment cell edits must be replaced in read-only mode.

### R4 - Live Write-Path Timing Requires A Disposable Project

Production write-path timing is allowed only when Ed explicitly approves:

- a dedicated production test account,
- a named disposable production project,
- exact project id,
- mutation scope,
- teardown or retention plan,
- run window.

The harness must not edit real client/project data to recreate the old local
stress edit scenarios.

### R5 - Secrets Must Stay Out Of The Repo

No production passwords, reset links, Render tokens, Cloudflare tokens, database
URLs, R2 keys, Fernet keys, account-token secrets, or session cookies may be
written into planning docs, `.env` files, logs committed to git, screenshots,
or scorecards.

Runtime secrets should be supplied via environment variables at execution time
or an operator-controlled secret manager. Scorecards record only account role,
project id, scenario scope, and redacted command shape.

### R6 - Observability Access Is Optional And Least-Privilege

Browser-side timing is enough for the first pass. Render or Cloudflare access is
optional and should be read-only if used.

Optional production observability may include:

- Render service metrics/logs for `ph-navigator-web` and `ph-navigator-api`,
- backend `/ready` pool metrics,
- Cloudflare cache/header observations.

Direct database credentials and R2 credentials are not required for frontend
performance testing and should not be requested for this packet.

## Non-Goals

- No production data seeding through local seed scripts.
- No direct production database access.
- No direct production R2 access.
- No use of Ed's personal production login unless Ed explicitly chooses that.
- No staging recreation in this packet.
- No Lighthouse-CI or automated deployment gate until the first production
  scorecard is reviewed.
- No performance refactor before a production scorecard identifies a measured
  issue.

## Acceptance Criteria

- A future agent can tell which credentials are needed for each run mode.
- The perf harness cannot accidentally mutate production when pointed at
  `www.ph-nav.com`.
- A public scorecard can run without secrets.
- An authenticated read-only scorecard can run with a dedicated test account
  and project id.
- Any write-path scorecard names the disposable production project and records
  teardown/retention.
- Production scorecards clearly separate browser transfer/runtime evidence from
  local build treemap ownership evidence.
