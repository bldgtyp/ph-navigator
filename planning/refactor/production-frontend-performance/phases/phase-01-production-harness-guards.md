---
DATE: 2026-06-29
TIME: 17:49 EDT
STATUS: Implemented locally - not run against production.
AUTHOR: Codex
SCOPE: Production-safety changes in the Playwright frontend perf matrix.
RELATED:
  - planning/refactor/production-frontend-performance/PLAN.md
  - frontend/tests/e2e/perf/perf-matrix.spec.ts
---

# Phase 01 - Production Harness Guards

Implemented in `frontend/tests/e2e/perf/perf-matrix.spec.ts`.

## Changes

- API response capture now derives from `E2E_API_BASE_URL`.
- If `E2E_BASE_URL=https://www.ph-nav.com` and `E2E_API_BASE_URL` is absent,
  the matrix infers `https://api.ph-nav.com`.
- Any `ph-nav.com` frontend/API target fails fast unless
  `PHN_PERF_PRODUCTION=1` is present.
- Production runs require explicit `E2E_EMAIL` and `E2E_PASSWORD`; the local
  `codex@example.com` / `password` fallback is not accepted for production.
- Production runs require either `PHN_PERF_READONLY=1` or
  `PHN_PERF_ALLOW_PRODUCTION_WRITES=1`.
- `PHN_PERF_READONLY=1` replaces the Spaces and Equipment cell-edit scenarios
  with non-mutating table hover interactions.
- `PHN_PERF_READONLY=1` also refuses a recovered-draft dialog instead of
  clicking `Discard draft`, because that recovery action is a write.
- Production route enumeration excludes the Model route by default because the
  first production fixture intentionally has no 3D Model. Set
  `PHN_PERF_INCLUDE_MODEL=1` only for a fixture that includes model data.
- Metrics JSON now records target metadata: frontend base URL, API base URL,
  production target flag, read-only flag, write-allowed flag, and whether the
  Model route was included.

## Verification

Commands run locally:

```bash
cd frontend && pnpm exec tsc -b --pretty false
cd frontend && pnpm exec eslint tests/e2e/perf/perf-matrix.spec.ts
cd frontend && pnpm exec playwright test --list tests/e2e/perf/perf-matrix.spec.ts
cd frontend && E2E_BASE_URL=https://www.ph-nav.com E2E_API_BASE_URL=https://api.ph-nav.com pnpm exec playwright test --list tests/e2e/perf/perf-matrix.spec.ts
```

Results:

- TypeScript passed.
- ESLint passed.
- Local dry listing enumerated 11 routes, including Model.
- Production dry listing enumerated 10 routes, excluding Model.

Not run:

- No authenticated production matrix.
- No production login.
- No production write-path test.
