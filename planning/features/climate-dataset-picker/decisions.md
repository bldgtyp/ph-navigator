---
DATE: 2026-06-21
TIME: -
STATUS: O-DP-1..4 resolved (Ed, 2026-06-21; O-DP-4 retired the browser in P2a);
  D-DP-6 (Ed, 2026-06-21) re-chose the renderer + tiles as **vanilla Leaflet +
  keyless OSM raster**, superseding the MapLibre/MapTiler half of D-DP-5 and
  **dissolving O4** (no key, no proxy, no committed secret); O-DP-5 (PHI seed)
  is a data/ops dependency, still open.
AUTHOR: Ed (via Claude)
SCOPE: Decision ledger + open questions for the climate dataset picker. Uses a
  D-DP-* prefix; references the parent climate ledger (D-CL-*) where it builds
  on accepted decisions.
RELATED:
  - PRD.md, README.md
  - planning/features/climate-auto-populate/decisions.md (D-CL-13/14/17/24, O4, O6)
---

# Climate Dataset Picker — Decisions

## Provisional (recommended; confirm or adjust in review)

### D-DP-1 · One generic component, two independent instances
A single `ClimateDatasetPickerModal(kind)` is mounted twice — `kind="phius"`
from the Phius page, `kind="phi"` from the PHI page — each attaching to its own
`project_climate_source` row. Same UI, separate data-items. (Confirmed by Ed in
the framing: "two pickers… use the same UI components so it feels the same.")

### D-DP-2 · Proximity is computed server-side, per location
The frontend renders pins from lat/long and prints backend distances/verdicts; it
runs no proximity math (hard rule: all calculations live in the backend). A new
project-scoped roster endpoint runs `build_proximity_payload` per station and
returns the list sorted nearest-first. Builds on D-CL-14 (proximity in `data`
JSONB) and D-CL-17 (the 50 mi/400 ft gate).

### D-DP-3 · Manual attach recomputes proximity authoritatively
On `POST` of a `phius`/`phi` source with a `ref`, the backend recomputes the
proximity payload (`auto_attached:false`) instead of trusting client `data` —
matching how auto-attach writes it.

### D-DP-4 · This modal replaces the dataset browser for phius/phi
`ClimateDatasetBrowser` is retired for the two PH kinds (this is the better
D-CL-24 realization). The "＋ Add source" page keeps ASHRAE / EPW / custom
attach, which the picker does not cover.

### D-DP-5 · Real basemap is the product map (O-DP-1 → resolved)
**Renderer + tile vendor superseded by D-DP-6** (Leaflet + OSM, not
MapLibre/MapTiler); the "real basemap from the start, not a schematic" intent
below still holds.

Ed chose the **real basemap from the start** (2026-06-21), not the schematic.
The picker renders MapLibre GL + MapTiler tiles with the project pin, station
pins, and the 50 mi limit ring. This makes **O4 a precondition of the frontend
phase** (P2), not a later enhancement: the MapTiler key + a pnpm-vetted map
dependency + a tiles budget/proxy must land before P2 ships. A **key-less
fallback** (a plain positioned-pin backdrop sharing the same pin-placement
helper) keeps CI, vitest, and key-less dev working; tests assert against that
fallback. P3 then **retrofits the app's other decorative maps** to the same
`<ClimateMap>` component (it is no longer where the basemap is *introduced*).

### D-DP-6 · Renderer = vanilla Leaflet; tiles = keyless OSM raster (supersedes D-DP-5 vendor; O4 → dissolved)
Ed re-chose the map stack (2026-06-21) after weighing it against the actual
requirement (pins + a 50 mi ring + pin-drop — no WebGL/vector-tile need):

- **Renderer = Leaflet, used vanilla (BSD-2-Clause), not `react-leaflet`.** A
  thin wrapper around `leaflet` + `@types/leaflet` keeps the dep BSD-2 and
  avoids `react-leaflet`'s non-OSI **Hippocratic License** landing in this public
  for-profit repo. ~42 KB vs MapLibre's ~200 KB+; the 50 mi ring is a one-liner
  (`L.circle([lat,lon], { radius: 80467 })`, true metric radius) and pin-drop is
  `map.on('click', …)` — both first-class in Leaflet, both extra work in MapLibre.
- **Tiles = keyless OSM raster** (`tile.openstreetmap.org`). The firm's volume
  (2-person, editor-only modal + a few decorative maps) sits far below the OSM
  tile policy's "heavy use" threshold; the risk is optics/SLA, not capacity.
- **O4 is dissolved, not merely deferred:** no tile key, no proxy, no committed
  secret. MapTiler stays in the stack for **geocoding only** (D-CL-15); its key
  is never used for tiles. If volume/optics ever demand a vetted vendor, swap the
  single tile-URL string to MapTiler raster — the renderer does not change.
- **Fallback unchanged:** `placePins` remains the key-less/test path; live mode
  uses Leaflet's own lat/lng→pixel projection. Distances/verdicts stay
  server-side (D-DP-2) — Leaflet only draws.

## Resolved (Ed, 2026-06-21)

### O-DP-1 · Map rendering for v1 — schematic vs. real basemap? → **REAL BASEMAP**
Ed chose the **MapLibre/MapTiler basemap now** (not the schematic). Folded into
D-DP-5: O4 (key + vetted dep + budget) becomes a P2 precondition; a key-less
fallback keeps CI/tests working; P3 retrofits the app's other maps.

### O-DP-2 · Selecting a *failing* Phius station? → **ALLOW WITH WARNING**
Allow attaching a failing station with an explicit warning; store `status:"fail"`
and surface the custom-set CTA (useful as a working basis until the custom set is
commissioned). PHI stays advisory. Folded into PRD §8.

### O-DP-3 · Cross-border sites? → **DEFAULT STATE + "ANY STATE" MODE**
Filter defaults to the project's derived state, plus a "Nearest to project (any
state)" mode (endpoint `near` ordering) for border sites. Folded into PRD §5/§4.2.

### O-DP-4 · Keep or retire `ClimateDatasetBrowser`? → **RETIRED (P2a)**
Confirmed D-DP-4: the generic browser is **deleted**; phius/phi attach through the
picker modal, and the "+ Add source" page keeps ASHRAE/EPW/custom. Done in P2a.

## Open questions

### O-DP-5 · PHI dataset availability
The PHI instance needs a seeded PHI dataset to exercise (dev DB has only
Phius/NY today — same gap noted as parent O5). Is a PHI seed available for dev,
or does the PHI picker ship behind the seed landing? *(Data/ops, not code.)*
Now tracked as the planned follow-up **`phases/phase-04-phi-dataset-seed.md`**;
the picker's PHI half shipped in P1–P3 and runs against its empty state until
the seed lands.
