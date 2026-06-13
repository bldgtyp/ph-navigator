---
DATE: 2026-06-13
TIME: -
STATUS: Deferred — gated on a concrete sectioned-inspection workflow.
AUTHOR: Claude (for Ed)
SCOPE: Status and gate for section / clipping planes.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# Section / Clipping Planes — Status

## Current state

`Deferred.` PRD, plan, and the Phase 1 handoff authored 2026-06-13. The
approach is low-ambiguity (global renderer clipping plane), so the plan
is ready whenever the gate opens. No code written.

## Gate to reopen

A named review workflow that needs sectioned model inspection (wall
section, interior walkthrough) that orbiting + the existing lenses
cannot serve. Engineering is ready; the trigger is a real use case
(Q-VIEW-8).

## Next step

None until the gate opens. When it does: implement
`phases/phase-01-axis-clipping.md`; run the pick-filtering spike early.

## Blockers

Gate only — not a technical blocker. Capped (filled) cross-sections are
explicitly out of scope; if hollow sections read poorly, open a
follow-up.
