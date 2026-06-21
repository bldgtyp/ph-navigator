---
DATE: 2026-06-21
TIME: -
STATUS: P1 DONE (backend roster + authoritative attach, tested green); P2 next
  but BLOCKED on O4 (MapTiler key + vetted dep + tiles budget). O-DP-1..3
  resolved by Ed (2026-06-21).
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate dataset picker feature.
RELATED:
  - README.md, PRD.md, decisions.md
  - phases/phase-01..03
---

# Climate Dataset Picker — Status

## Current state

**P1 shipped (2026-06-21).** The backend feed and authoritative attach are
implemented and tested green (focused pytest + full backend suite). Delivered:
the project-scoped roster endpoint
(`GET …/projects/{id}/climate/datasets/{kind}/locations`, editor-only) with
per-station backend proximity sorted nearest-first; region default = project
state + `near` any-state mode; `dataset:null` when a kind is unseeded; the
no-location 409 guard; and server-authoritative proximity recompute on manual
`phius`/`phi` attach (client `data` discarded). Proximity math is now a shared
verdict/roster seam reused by both auto-attach and the picker (see
`phases/phase-01` Outcome). No frontend yet (P2).

**Ed's design answers (2026-06-21):** real MapLibre/MapTiler basemap (not a
schematic) → O-DP-1; allow selecting a failing Phius station with an explicit
warning → O-DP-2; default the state filter to the project's state plus an
"any-state" nearest mode → O-DP-3.

## Next step

**Phase 2** (picker modal + MapLibre/MapTiler basemap) is the next phase, but it
is **BLOCKED on O4** — the real basemap requires a MapTiler tile key, a
pnpm-vetted map dependency, and a tiles proxy/budget, none of which are
code-resolvable here. Unblock O4 (provision the key + vet the dep + stand up the
tiles proxy/referrer-scoped key so no secret is committed), then build the
generic `ClimateDatasetPickerModal(kind)` against the P1 roster endpoint with a
key-less fallback for CI/tests. Also confirm O-DP-4 (retire the browser for
phius/phi) and O-DP-5 (PHI seed availability).

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
