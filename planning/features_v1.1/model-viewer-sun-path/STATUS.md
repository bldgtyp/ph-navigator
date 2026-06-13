---
DATE: 2026-06-13
TIME: -
STATUS: Active — planned, not started.
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

`Active — planned. REALIGNED 2026-06-13` to frontend-only. PRD,
decisions, plan, and both phase handoffs authored 2026-06-13. No code
written. The sun-path **backend** moved to Climate Phase 1
(`planning/features/climate/`); this feature is now the Model Viewer
**frontend** consumer.

## Next step

Implement `phases/phase-01-static-sun-path.md` **after Climate Phase 1
ships** the `GET /projects/{id}/sun-path` endpoint. The work here is the
frontend render: query the endpoint, complete `SiteSunLayer` (monthly
arcs + compass), fit to model bounds, flip the location hint. D-SP-1
accepted; no decisions open for this feature.

## Blockers

- **Climate Phase 1** (`planning/features/climate/phases/phase-01-sun-path-service.md`)
  must ship first — it owns the endpoint this feature consumes. That is
  the only blocker. Setter UI + location data already exist.

## Prerequisites

- **Climate Phase 1 (`planning/features/climate/`) — NOT yet built.**
  The gating prerequisite (owns the sun-path endpoint).
- Model Viewer MVP Phases 2 + 6 merged (Site & Sun renderer stub; the
  geometry/bounds this render fits to) — met.
- `project-location` implemented + archived (data + setter UI) — met;
  Climate Phase 1 consumes it.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Site & Sun 3D render (frontend) | Planned | Climate Phase 1 merged |
| 2 — Scrubber | Deferred | Phase 1 merged + named time/season need |
