---
DATE: 2026-06-24
TIME: 22:24 EDT
STATUS: Phase 04D secondary runtime attribution captured
AUTHOR: Codex
SCOPE: Corrected interaction long-task attribution and secondary runtime decision.
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04d-secondary-runtime.md
  - frontend/tests/e2e/perf/perf-matrix.spec.ts
---

# Phase 04D Scorecard - Secondary Runtime

## Change

- Reset `window.__PHN_PERF_LONG_TASKS__` immediately before each scripted
  interaction, matching the existing React Profiler reset, and filter any late
  observer deliveries against the reset timestamp.
- Record LCP element metadata (`lcpEntry`) in each perf JSON file.

## Corrected Rows

`make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
passed 11/11.

| Page | Interaction | LCP | Long tasks | Max long task | React commits | React actual duration |
|---|---:|---:|---:|---:|---:|---:|
| envelope | 283 ms | 656 ms | 0 | 0 ms | 3 | 10.0 ms |
| materials-catalog | 281 ms | 52 ms | 0 | 0 ms | 0 | 0.0 ms |
| frame-types-catalog | 279 ms | 44 ms | 0 | 0 ms | 0 | 0.0 ms |
| glazing-types-catalog | 282 ms | 52 ms | 0 | 0 ms | 0 | 0.0 ms |

## Attribution

- Catalog hover: the original 2-3 long-task signal came from cold route load
  because long tasks were not reset before the hover scenario. After the reset,
  catalog hover has no long tasks and no React commits.
- Envelope LCP: the LCP element is the recovered-draft message:
  `"Your edits were auto-saved to a server draft..."`. This is test/session
  state, not Assembly Builder first-view rendering.

## Decision

No production refactor is promoted from Phase 04D.

Follow-up only if this candidate is reopened: first measure Envelope from a
clean no-draft project/session so the LCP element is actual route content.

## Verification

- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498` - passed 11/11.
