---
DATE: 2026-06-21
TIME: -
STATUS: P1 DONE (backend roster + authoritative attach); P2a DONE (key-less
  picker scaffold), both tested green; P2b (live basemap) BLOCKED on O4
  (MapTiler key + vetted dep + tiles budget). O-DP-1..4 resolved by Ed
  (2026-06-21).
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate dataset picker feature.
RELATED:
  - README.md, PRD.md, decisions.md
  - phases/phase-01..03
---

# Climate Dataset Picker — Status

## Current state

**P1 + P2a shipped (2026-06-21).**

- **P1 (backend):** the project-scoped roster endpoint
  (`GET …/projects/{id}/climate/datasets/{kind}/locations`, editor-only) with
  per-station backend proximity sorted nearest-first; region default = project
  state + `near` any-state mode; `dataset:null` when unseeded; the no-location
  409 guard; server-authoritative proximity recompute on manual attach. The
  proximity math is a shared verdict/roster seam reused by auto-attach + the
  picker (`phases/phase-01` Outcome).
- **P2a (frontend, key-less scaffold):** the generic
  `ClimateDatasetPickerModal(kind)` on the P1 roster endpoint — state filter
  (default project state + any-state), nearest-first list with status chips,
  select→preview→attach (failing-Phius warning), no-location + unseeded guards,
  editor-only; `<ClimateMap>` in its key-less positioned-pin fallback; attach is
  upsert-by-kind so "Replace" reuses the create path; entry points from the
  Phius/PHI detail header, the sidebar missing-source card, and the fail page;
  `ClimateDatasetBrowser` deleted (`phases/phase-02` Outcome). vitest + full CI
  green.

**Ed's design answers (2026-06-21):** real MapLibre/MapTiler basemap → O-DP-1;
allow selecting a failing Phius station with a warning → O-DP-2; default the
state filter to the project's state plus an "any-state" mode → O-DP-3; retire the
browser for phius/phi → O-DP-4.

## Next step

**P2b (live basemap)** is the only remaining picker work and is **BLOCKED on O4**:
layer MapLibre GL + MapTiler tiles into `<ClimateMap>` behind the existing
key-less fallback. Unblock O4 first — provision the MapTiler tile key (confirm
tile terms + budget), vet + add the map dependency through the pnpm gate, and
stand up the tile proxy / referrer-scoped key so no secret is committed
(public repo). The vendor (MapLibre GL JS vs `@maptiler/sdk`) and tile-serving
approach are Ed's calls, deferred to when O4 is provisioned. Then **P3** retrofits
the app's other decorative maps to the same `<ClimateMap>`. Still open: O-DP-5
(a PHI dataset seed to exercise the PHI picker end-to-end).

## Blockers

- **O4** (MapTiler key + a vetted map dependency + tiles proxy/budget) **gates
  Phase 2** — Ed chose the real basemap over a schematic, so it is on the
  critical path. P1 shipped without it. A key-less fallback keeps CI green
  regardless, but the key/dep/proxy must land before P2 ships.
- **O-DP-5 / parent O5** — a PHI dataset seed is needed to exercise the PHI
  instance end-to-end (dev DB has only Phius/NY).

## Verification plan

Per phase: focused pytest (roster proximity + sort + authoritative attach),
vitest for the modal (filter, list order, chips, select→attach, no-location
guard, viewer gating), Playwright MCP visual pass from both the Phius and PHI
pages, and `make ci` green.
