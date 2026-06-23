---
DATE: 2026-06-13
TIME: -
STATUS: Active — planned, not started.
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for legend-as-filter.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Legend as Filter — Status

## Current state

`Active — planned; docs reconciled 2026-06-23.` PRD, plan, and both
phase handoffs authored 2026-06-13, then reconciled to the batched-
rendering refactor (`dbca4650`, 2026-06-19): the per-object render gate
the plan assumed no longer exists, so isolation now hides non-matching
*faces* on the batch (`setVisibleAt`) while keeping the merged edge line
as wireframe context. No code written. No open decisions — PRD §5 settled
on **isolate-with-wireframe-context** (was plain "hide"); frontend-only,
no new data.

## Next step

Implement `phases/phase-01-single-select-isolate.md`. This is the
highest-value, lowest-risk post-MVP candidate after sun path — Ed
flagged it near-priority and the MVP already staged the legend rows
(D-11) and the bucket-key function.

## Blockers

None. Depends only on the merged MVP (legend card + theme bucket
mapping), which is complete.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Single-select isolate | Planned | none (ready) |
| 2 — Multi-select + polish | Planned | Phase 1 merged |
