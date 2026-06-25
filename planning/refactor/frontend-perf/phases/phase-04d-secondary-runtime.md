---
DATE: 2026-06-24
TIME: 21:13 EDT
STATUS: Planned - implementation not started
AUTHOR: Codex
SCOPE: Secondary runtime investigation plan for Envelope LCP and catalog hover long tasks
RELATED:
  - planning/refactor/frontend-perf/phases/phase-04-ranking.md
  - planning/refactor/frontend-perf/scorecard-2026-06-24.md
---

# Phase 04D - Secondary Runtime

## Goal

Convert lower-priority runtime observations into trace-backed refactor candidates. This phase is investigative first; it should not start with implementation.

## Current Signals

Envelope:

- LCP 928 ms.
- scripted interaction 289 ms.
- 0 long tasks.
- 3 React update commits.
- 15.1 ms total actual render.

Catalog hovers:

- Materials: 274 ms script, 2 long tasks, max 97 ms, 0 React commits.
- Frame Types: 274 ms script, 3 long tasks, max 112 ms, 0 React commits.
- Glazing Types: 281 ms script, 2 long tasks, max 101 ms, 0 React commits.

## Phase Plan

### 1. Envelope LCP Attribution

Capture an LCP-focused trace for the Envelope route.

Questions:

- Is the LCP element text, table chrome, assembly content, or a loading shell?
- Is the 928 ms delay network, render scheduling, CSS/layout, or data processing?
- Does route payload splitting from Phase 04B lower this number without Envelope-specific edits?

Exit condition: one trace-backed cause for the LCP delay.

### 2. Catalog Hover Long-Task Attribution

Capture a focused hover trace for the three catalog routes.

Questions:

- Are long tasks caused by hover handlers, browser layout/paint, table hit testing, or tooltip/menu code?
- Do route payload splits change hover long tasks?
- Are catalog hovers sharing the same DataTable path as Phase 04A, or are they CSS/layout-only?

Exit condition: one trace-backed cause for each catalog route or one shared cause across all three.

### 3. Decide Whether to Promote

Promote a secondary runtime item only if:

- the cause is clear,
- the fix is localized,
- the user-visible effect is meaningful,
- and it does not interfere with Phase 04A or Phase 04B.

## Verification

- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Targeted browser trace for `/projects/:projectId/envelope`.
- Targeted browser hover trace for `/catalog/materials`, `/catalog/frame-types`, `/catalog/glazing-types`.
- Update the frontend-perf scorecard with promoted or rejected candidates.

## Stop Conditions

- Stop if Phase 04B route splitting resolves enough of the Envelope LCP that no local Envelope refactor is justified.
- Stop if catalog hover tasks are browser layout/paint effects without a practical code-level fix.
- Stop if trace evidence is inconclusive.
