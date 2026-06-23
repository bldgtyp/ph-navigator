---
DATE: 2026-06-13
TIME: -
STATUS: Active — Phase 1 implemented; Phase 2 pending.
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for legend-as-filter.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Legend as Filter — Status

## Current state

`Active — Phase 1 implemented 2026-06-23.` PRD, plan, and both phase
handoffs authored 2026-06-13, then reconciled to the batched-rendering
refactor (`dbca4650`, 2026-06-19) on 2026-06-23. **Phase 1 (single-select
isolate) is implemented** on the worktree branch and green — frontend gate
(`tsc`/lint/build) + 13 new `legendFilter` vitest cases + a Playwright spec;
not yet merged. Isolation hides non-matching *faces* on the batch
(`setVisibleAt`) and keeps the merged edge line as lightened wireframe
context (PRD §5). No open decisions; frontend-only, no new data. Phase 2
(multi-select + polish) is not started.

## Next step

Implement `phases/phase-02-multiselect-polish.md` — shift-click union
semantics, active-row styling polish, the a11y pass, and mini-key parity.

## Blockers

None. Depends only on the merged MVP (legend card + theme bucket
mapping), which is complete.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Single-select isolate | Implemented ✓ (tests green; unmerged) | — |
| 2 — Multi-select + polish | Planned | Phase 1 complete |
