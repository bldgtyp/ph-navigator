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

`Active — planned.` PRD, decisions, plan, and both phase handoffs
authored 2026-06-13. No code written.

## Next step

Implement `phases/phase-01-static-sun-path.md`. **D-SP-1 is accepted**
(Ed 2026-06-13): the sun path is served from a separate, project-scoped,
location-reactive endpoint + store; the `/model_data` artifact stays
immutable with `sun_path` null. No decisions remain open.

## Blockers

None. The setter UI already shipped with `project_location`
(`ProjectLocationSettingsSection.tsx`); this feature only consumes the
location data. Ready to implement.

## Prerequisites (met)

- Model Viewer MVP Phases 2 + 6 merged (ladybug/honeybee deps; Site &
  Sun renderer stub; `SunPathAndCompassDTOSchema` wire shape).
- `project-location` implemented and archived
  (`planning/archive/project-location/`) — confirmed by Ed 2026-06-13.
  Location data is available in-process via
  `features/project_location/repository.py`.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Static sun path | Planned — ready (D-SP-1 accepted) | none |
| 2 — Scrubber | Deferred | Phase 1 merged + named time/season need |
