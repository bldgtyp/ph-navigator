---
DATE: 2026-06-13
TIME: -
STATUS: Complete — implemented, merged to main, archived (v1.1).
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for legend-as-filter.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Legend as Filter — Status

> **Complete & archived (2026-06-23).** Both phases implemented and landed
> on `main`; this folder moved to `planning/archive/`. History below is
> retained for reference.

## Current state

`Implemented (Phases 1–2) 2026-06-23; unmerged.` PRD/plan/phase handoffs
authored 2026-06-13, reconciled to the batched-rendering refactor
(`dbca4650`) on 2026-06-23, then both phases implemented on the
`worktree-model-viewer-legend-filter` branch. Isolation hides non-matching
*faces* on the batch (`setVisibleAt`) and keeps the merged edge line as
lightened wireframe context (PRD §5); line lenses dim non-matching lines in
place. Single-select on plain click, shift-click union (Phase 2), Clear
control + Esc, filter-aware debug hook. Green: `make ci-frontend` (full
vitest suite + lint + build) and 15 `legendFilter` vitest cases. Two
Playwright specs (`model-viewer-legend-filter.spec.ts`) are written and run
in the e2e job; **not executed locally this session** (needs the full
stack). Frontend-only, no new data, no open decisions.

## Next step

Done — merged to `main` and archived. The Playwright specs
(`model-viewer-legend-filter.spec.ts`) run in the e2e job.

## Blockers

None. Depends only on the merged MVP (legend card + theme bucket
mapping), which is complete.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Single-select isolate | Implemented ✓ (tests green; unmerged) | — |
| 2 — Multi-select + polish | Implemented ✓ (tests green; unmerged) | — |
