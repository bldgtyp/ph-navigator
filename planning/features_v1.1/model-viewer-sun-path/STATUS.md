---
DATE: 2026-06-13
TIME: -
STATUS: Active — unblocked (Climate Phase 1 endpoint shipped 2026-06-13),
  frontend not started.
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for the sun-path feature.
RELATED:
  - README.md
  - PRD.md
  - decisions.md
  - PLAN.md
---

# Sun Path — Status

## Current state

`Active — unblocked, not started. REALIGNED 2026-06-13` to frontend-only.
PRD, decisions, plan, and both phase handoffs authored 2026-06-13. No
frontend code written. The sun-path **backend** moved to Climate Phase 1
(`planning/archive/climate/`), which **shipped the endpoint 2026-06-13**;
this feature is now the Model Viewer **frontend** consumer and is ready to
start.

## Next step

Implement `phases/phase-01-static-sun-path.md` — the gating Climate Phase
1 `GET /projects/{id}/sun-path` endpoint now exists. The work here is the
frontend render: query the endpoint, complete `SiteSunLayer` (monthly
arcs + compass), fit to model bounds, flip the location hint. D-SP-1
accepted; no decisions open for this feature.

## Blockers

- **None** — the only blocker (Climate Phase 1) is cleared. The
  `GET /projects/{id}/sun-path` endpoint this feature consumes was
  implemented 2026-06-13
  (`planning/archive/climate/phases/phase-01-sun-path-service.md`,
  `make ci` green, pending commit/merge).

## Prerequisites

- **Climate Phase 1 (`planning/archive/climate/`) — implemented
  2026-06-13** (pending merge). The gating prerequisite (owns the
  sun-path endpoint) is met.
- Model Viewer MVP Phases 2 + 6 merged (Site & Sun renderer stub; the
  geometry/bounds this render fits to) — met.
- `project-location` implemented + archived (data + setter UI) — met;
  Climate Phase 1 consumes it.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Site & Sun 3D render (frontend) | Planned | Climate Phase 1 merged |
| 2 — Scrubber | Deferred | Phase 1 merged + named time/season need |
