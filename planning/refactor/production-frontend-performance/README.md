---
DATE: 2026-06-29
TIME: 18:56 EDT
STATUS: Implemented through fixture setup path - production run held.
AUTHOR: Codex
SCOPE: Router for adapting the archived local frontend performance harness into
  a production-safe performance validation workflow for `www.ph-nav.com`.
RELATED:
  - planning/refactor/production-frontend-performance/PRD.md
  - planning/refactor/production-frontend-performance/PLAN.md
  - planning/refactor/production-frontend-performance/STATUS.md
  - planning/refactor/production-frontend-performance/phases/phase-00-credentials-and-access.md
  - planning/refactor/production-frontend-performance/phases/phase-01-production-harness-guards.md
  - planning/refactor/production-frontend-performance/phases/phase-03-production-fixture-setup.md
  - planning/code-reviews/2026-06-29/production-frontend-performance-review-plan.md
  - planning/archive/dated/2026-06-25/frontend-perf/README.md
  - context/PRODUCTION_DEPLOYMENT.md
---

# Production Frontend Performance Refactor

## Read Order

1. `phases/phase-00-credentials-and-access.md` - required access decisions
   before any authenticated production testing.
2. `phases/phase-01-production-harness-guards.md` - implemented Playwright
   production guard behavior.
3. `phases/phase-03-production-fixture-setup.md` - implemented guarded fixture
   setup command.
4. `PRD.md` - production-safe behavior contract and non-goals.
5. `PLAN.md` - phase sequence for harness edits, public baseline,
   authenticated read-only scorecard, and optional write-path scorecard.
6. `STATUS.md` - current state, decisions, open questions, and next step.
7. `planning/code-reviews/2026-06-29/production-frontend-performance-review-plan.md`
   - source review that compared the archived local perf setup to production.

## Why This Is Under `planning/refactor`

This is cross-cutting harness and validation work, not a product feature. It
touches the Playwright perf matrix, production run policy, scorecard format,
and possibly deployment/observability checks across every page. The repo
planning rules route that kind of cleanup/execution work to
`planning/refactor/<slug>/`.

## Scope Summary

The goal is a production-safe way to answer: "How does the live PH-Navigator
frontend perform now that `www.ph-nav.com` and `api.ph-nav.com` are real?"

The archived local `frontend-perf` packet remains the method baseline:

- three layers: payload, runtime/load, render,
- fixed route matrix,
- stress and realistic tiers where safe,
- dated scorecards,
- before/after evidence for any promoted fix.

Production changes the constraints:

- the production database and R2 bucket are real infrastructure,
- there is no active staging stack,
- production accounts should not be shared casually,
- Ed's personal session should not be invalidated by test automation,
- write-path tests must not touch real project data unless explicitly approved.

## Phase Map

| Phase | Status | Output |
|---|---|---|
| 00 - Credentials and access | Decision recorded | `codex@testing.com`, `PERF-STRESS`, 250-row reset-in-place fixture, Climate/Envelope/Apertures included, Model excluded |
| 01 - Production harness guards | Implemented locally | `perf-matrix` can target production only with explicit env flags and read-only mode |
| 02 - Public anonymous baseline | Planned | Scorecard rows for public shell/readiness/static asset timing |
| 03 - Production fixture setup | Implemented locally | Production-safe one-off creates/resets the `PERF-STRESS` fixture for `codex@testing.com` |
| 04 - Authenticated fixture baseline | Planned | Full route matrix against the seeded fixture, read-only first |
| 05 - Optional fixture write baseline | Deferred pending run decision | Table-edit scorecard isolated to `PERF-STRESS` only |
| 06 - Triage and budget decisions | Planned | Ranked findings and decision on whether any metric becomes a gate |

## Current Handoff

Current state:

- Harness code and fixture setup command are implemented locally.
- Focused local validation passed.
- Production fixture setup has not been executed.
- Authenticated production performance testing has not been run.
- Production write-path timing remains held.

Next actions, in order:

1. Choose the runtime-only password for `codex@testing.com`.
2. Run the guarded fixture setup command in the production API environment.
3. Capture the printed `PERF_PROJECT_ID` in this packet's `STATUS.md`.
4. Wait for explicit approval before running the authenticated read-only matrix.
5. After the run, summarize results in a dated scorecard under this refactor
   packet.

Do not run the production matrix from local defaults or without
`PHN_PERF_PRODUCTION=1` and `PHN_PERF_READONLY=1`.
