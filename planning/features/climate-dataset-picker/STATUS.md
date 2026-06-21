---
DATE: 2026-06-21
TIME: -
STATUS: Draft — PRD + phase outline written; O-DP-1..3 resolved by Ed
  (2026-06-21); ready to start P1. O4 now on the critical path (gates P2).
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate dataset picker feature.
RELATED:
  - README.md, PRD.md, decisions.md
  - phases/phase-01..03
---

# Climate Dataset Picker — Status

## Current state

`Draft — planning; design questions resolved`. PRD, decisions (D-DP-1..5;
O-DP-1..3 resolved, O-DP-4..5 open), and three phase plans written. No code yet.
Backend capability confirmed: `climate_dataset_location` already carries state
(`region`) + lat/long/elevation per station, and
`proximity.build_proximity_payload` already computes the authoritative
distance/Δelev/pass-fail — both reused, so Phase 1 is additive (a project-scoped
roster endpoint + per-location proximity + authoritative attach), not a rebuild.

**Ed's design answers (2026-06-21):** real MapLibre/MapTiler basemap (not a
schematic) → O-DP-1; allow selecting a failing Phius station with an explicit
warning → O-DP-2; default the state filter to the project's state plus an
"any-state" nearest mode → O-DP-3.

## Next step

Start **Phase 1** (backend roster endpoint + authoritative attach) — it has no
external dependency. In parallel, kick off **O4 procurement** (MapTiler tile key
+ pnpm-vetting the MapLibre dependency + a tiles proxy/budget), since the real
basemap choice puts O4 on the critical path for Phase 2. Confirm O-DP-4 (retire
the browser for phius/phi — Claude's default) and O-DP-5 (PHI seed availability).

## Blockers

- **O4** (MapTiler key + a vetted map dependency + tiles proxy/budget) now gates
  **Phase 2** — Ed chose the real basemap over a schematic, so it is on the
  critical path. P1 is unblocked. A key-less fallback keeps CI green regardless.
- **O-DP-5 / parent O5** — a PHI dataset seed is needed to exercise the PHI
  instance end-to-end (dev DB has only Phius/NY).

## Verification plan

Per phase: focused pytest (roster proximity + sort + authoritative attach),
vitest for the modal (filter, list order, chips, select→attach, no-location
guard, viewer gating), Playwright MCP visual pass from both the Phius and PHI
pages, and `make ci` green.
