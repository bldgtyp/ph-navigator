---
DATE: 2026-06-24
TIME: 22:24 EDT
STATUS: Complete - secondary runtime attribution measured; no production refactor promoted
AUTHOR: Codex
SCOPE: Secondary runtime attribution plan for Envelope LCP and catalog hover long tasks
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04-ranking.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24-phase-04d.md
  - frontend/tests/e2e/perf/perf-matrix.spec.ts
---

# Phase 04D - Secondary Runtime

## Goal

Convert lower-priority runtime observations into metrics-backed refactor
candidates. This phase is investigative first; it should not start with
production implementation.

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

Capture LCP attribution for the Envelope route.

Questions:

- Is the LCP element text, table chrome, assembly content, or a loading shell?
- Is the 928 ms delay network, render scheduling, CSS/layout, or data processing?
- Does route payload splitting from Phase 04B lower this number without Envelope-specific edits?

Exit condition: one metrics-backed cause for the LCP delay.

Result:

- The perf matrix now records LCP element metadata. A DevTools trace is still
  deferred unless this candidate is reopened.
- Current Envelope LCP is the recovered-draft message:
  `"Your edits were auto-saved to a server draft..."`.
- React work remains small: 3 commits / 10.0 ms actual duration.
- No Envelope production refactor is promoted from this signal. Re-measure a
  clean no-draft Envelope load before revisiting this candidate.

### 2. Catalog Hover Long-Task Attribution

Capture focused hover metrics for the three catalog routes.

Questions:

- Are long tasks caused by hover handlers, browser layout/paint, table hit testing, or tooltip/menu code?
- Do route payload splits change hover long tasks?
- Are catalog hovers sharing the same DataTable path as Phase 04A, or are they CSS/layout-only?

Exit condition: one metrics-backed cause for each catalog route or one shared cause across all three.

Result:

- The original catalog long-task signal was a harness attribution issue. The
  matrix reset React commits before the scripted hover, but left cold-load long
  tasks accumulated.
- `frontend/tests/e2e/perf/perf-matrix.spec.ts` now resets long tasks before
  each scripted interaction.
- Corrected catalog hover rows show 0 long tasks and 0 React commits for
  Materials, Frame Types, and Glazing Types.
- No catalog hover production refactor is promoted.

### 3. Decide Whether to Promote

Promote a secondary runtime item only if:

- the cause is clear,
- the fix is localized,
- the user-visible effect is meaningful,
- and it does not interfere with Phase 04A or Phase 04B.

Decision:

- Reject both secondary runtime candidates for this packet.
- Keep the corrected harness because it prevents future cold-load long tasks
  from being mislabeled as interaction work.

## Verification

- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- LCP element metadata for `/projects/:projectId/envelope`.
- Corrected scripted-interaction long-task metrics for `/catalog/materials`,
  `/catalog/frame-types`, `/catalog/glazing-types`.
- Update the frontend-perf scorecard with promoted or rejected candidates.

Verification completed:

- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
  passed 11/11 with corrected interaction long-task attribution.
- Envelope row: interaction 283 ms, LCP 656 ms, 0 long tasks, 3 React commits,
  10.0 ms actual render; LCP element is the recovered-draft message.
- Catalog rows: Materials 281 ms / 0 long tasks / 0 React commits; Frame Types
  279 ms / 0 long tasks / 0 React commits; Glazing Types 282 ms / 0 long tasks
  / 0 React commits.

## Stop Conditions

- Stop if Phase 04B route splitting resolves enough of the Envelope LCP that no local Envelope refactor is justified.
- Stop if catalog hover tasks are browser layout/paint effects without a practical code-level fix.
- Stop if trace evidence is inconclusive.

Stop decision:

- Stop with no production refactor. The catalog signal was corrected away by
  better measurement, and the Envelope LCP signal points to recovered-draft
  state rather than a localized render bottleneck.
