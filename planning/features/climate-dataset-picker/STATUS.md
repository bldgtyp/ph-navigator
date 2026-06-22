---
DATE: 2026-06-22
TIME: -
STATUS: **All phases DONE (2026-06-22).** P1 (backend roster + authoritative
  attach); P2a (key-less picker scaffold); P2b (live Leaflet/OSM basemap); P3
  (app-wide map retrofit — Location / sidebar / Set-Location pin-drop). All
  tested green + verified live in-browser. D-DP-6 chose vanilla Leaflet + keyless
  OSM raster, dissolving O4 (no key/proxy/secret), now closed app-wide. O-DP-1..4
  resolved (Ed, 2026-06-21). Only **O-DP-5** (PHI dataset seed; data/ops) open.
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate dataset picker feature.
RELATED:
  - README.md, PRD.md, decisions.md
  - phases/phase-01..03
---

# Climate Dataset Picker — Status

## Current state

**Feature complete — P1 + P2a + P2b + P3 shipped (P3 2026-06-22).**

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
- **P2b (frontend, live basemap):** the **vanilla-Leaflet + keyless-OSM-raster**
  basemap (D-DP-6) layered into `<ClimateMap>` behind the `placePins` fallback —
  a `createClimateLeafletMap` controller (`components/climateLeafletMap.ts`)
  draws OSM tiles + attribution, the project pin, proximity-coloured station
  pins, the 50 mi `L.circle` ring (80,467 m), selection ↔ row sync, and
  pin-marker click→select; colours resolve from CSS tokens at runtime (no hex).
  `<ClimateMap>` mounts it via a lazy `import()` only outside the test runtime
  (`import.meta.env.MODE !== "test"`); jsdom/test and any Leaflet init failure
  fall back to `placePins`, so vitest stays deterministic. `leaflet` (BSD-2,
  zero deps) + `@types/leaflet` added through the pnpm gate — **not**
  `react-leaflet` (Hippocratic License). vitest + build + guards green; verified
  live in-browser (`phases/phase-02` Outcome — P2b).
- **P3 (frontend, app-wide map retrofit):** `<ClimateMap>` generalized into the
  app's **one shared map** and adopted by all the decorative surfaces — the
  Location-page big map (project pin), the sidebar mini-map (static,
  non-interactive thumbnail), and the **Set-Location pin-drop** (a map click
  writes lat/long back via `onPickPoint`). The controller gained
  `{ interactive, onSelectStation?, onPickPoint? }`; the component owns the
  no-location empty surface (`project: LatLon | null`) so no caller guards.
  Shared chrome in `climate-map.css`. O4 closed app-wide. vitest + build +
  guards green; verified live in-browser (`phases/phase-03` Outcome — P3).

**Ed's design answers (2026-06-21):** real basemap (renderer later re-chosen to
Leaflet/OSM by D-DP-6) → O-DP-1; allow selecting a failing Phius station with a
warning → O-DP-2; default the state filter to the project's state plus an
"any-state" mode → O-DP-3; retire the browser for phius/phi → O-DP-4.

## Next step

**The picker feature is complete** — all four implemented phases (P1, P2a, P2b,
P3) shipped and verified. The only open item is **O-DP-5**, now tracked as a
clearly-planned follow-up: **`phases/phase-04-phi-dataset-seed.md`** — seed a
PHI dataset for the dev DB so the PHI instance of the picker can be exercised
end-to-end (today only Phius/NY is seeded). That is a **data/ops** dependency,
not code, and is **not** required to call the picker done.

One small piece of acknowledged debt (P3 simplify review): the sidebar
`LocationCard` is a `role="button"` div rather than a native `<button>` (so the
live mini-map `<div>` can nest inside it), which diverges from the sibling
source cards. Revisit if the sidebar's cards are reworked.

## Blockers

- **O4 — DISSOLVED (D-DP-6, 2026-06-21).** Choosing vanilla Leaflet + keyless
  OSM raster removes the key, the proxy, and the tiles budget entirely, so the
  former Phase-2 blocker is gone. MapTiler remains only for geocoding (D-CL-15),
  never tiles. (Migrating to a vetted tile vendor later is a one-line tile-URL
  swap, not a blocker.)
- **O-DP-5 / parent O5** — a PHI dataset seed is needed to exercise the PHI
  instance end-to-end (dev DB has only Phius/NY).

## Verification plan

Per phase: focused pytest (roster proximity + sort + authoritative attach),
vitest for the modal (filter, list order, chips, select→attach, no-location
guard, viewer gating), Playwright MCP visual pass from both the Phius and PHI
pages, and `make ci` green.
