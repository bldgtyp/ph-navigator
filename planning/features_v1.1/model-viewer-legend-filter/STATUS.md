---
DATE: 2026-06-13
TIME: -
STATUS: Implemented (Phases 1–2); unmerged.
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for legend-as-filter.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Legend as Filter — Status

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

Land it — open a PR from the `worktree-model-viewer-legend-filter` branch
and let the e2e job exercise the new Playwright specs.

## Blockers

None. Depends only on the merged MVP (legend card + theme bucket
mapping), which is complete.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Single-select isolate | Implemented ✓ (tests green; unmerged) | — |
| 2 — Multi-select + polish | Implemented ✓ (tests green; unmerged) | — |
