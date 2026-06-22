---
DATE: 2026-06-22
TIME: -
STATUS: All phases DONE (2026-06-22) — P1 (backend roster + attach, §4/§10),
  P2a (key-less picker scaffold, §3/§5/§8), P2b (live basemap, §6 — vanilla
  Leaflet + keyless OSM raster per D-DP-6, O4 dissolved), P3 (app-wide map
  retrofit; O4 closed everywhere). O-DP-1..4 resolved by Ed 2026-06-21 (real
  basemap; allow-failing-Phius-with-warning; default-state + any-state; browser
  retired). Only O-DP-5 (PHI seed) data/ops open.
AUTHOR: Ed (via Claude)
SCOPE: Product / behavior contract for the manual climate-dataset picker — a
  map + state-filter modal that lets an editor browse the available PH climate
  datasets for a state, see each one's proximity to the project, and attach
  one. Used independently from the Phius page and the PHI page (same UI
  components, separate project data-items). The manual-override counterpart to
  the climate-auto-populate finder.
RELATED:
  - README.md, decisions.md, STATUS.md, phases/
  - planning/features/climate-auto-populate/ (the auto-attach this complements;
    D-CL-17 proximity rules, D-CL-24 browser-demotion, O4 map tiles, O6 override)
  - backend/features/climate/ (datasets, locations, proximity.py)
  - backend/features/project_climate_source/ (attach/CRUD)
  - frontend/src/features/climate/ (the tab + add surface this plugs into)
---

# Climate Dataset Picker — PRD

## 1. Goal

Give the editor an **explicit, map-first way to choose the project's PH climate
dataset** — instead of relying only on the address-derived auto-attach. From the
Phius page (and, identically, the PHI page), the editor opens a picker that:

1. filters the available datasets by **US state**,
2. shows a **map** with the **project location** and **every available dataset
   station for that state**, so the closer options are obvious at a glance, and
3. lets the editor **select one and attach it** to the project — with each
   option's certification proximity (distance + Δelevation, pass/fail) shown.

This realizes the manual override path that `climate-auto-populate` deferred
(D-CL-24 "the dataset browser demotes to a manual add/override surface"; O6 "the
custom-set / override outcome"), and forces the O4 map decision (§6).

## 2. Primary user story

> As a designer, the auto-attached Phius station isn't always the one I want —
> a closer station may have been skipped, or the nearest one fails the
> proximity rule and I need to see my real options. I open the Phius page,
> click **Change dataset**, pick my state, and see a map with my project pinned
> and every Phius station in the state pinned around it, each labeled with its
> distance and whether it passes the 50 mi / 400 ft rule. I click the one I
> want, confirm, and it's attached. I do the same on the PHI page for the PHI
> dataset — same screen, different data.

## 3. One component, two independent instances (D-DP-1)

The picker is a **single generic component** parameterized by source `kind`.
It is mounted **twice, independently**:

- the **Phius page** mounts it with `kind="phius"`,
- the **PHI page** mounts it with `kind="phi"`.

Each instance reads its own dataset roster and attaches to its own
**independent `project_climate_source` row** (`kind="phius"` vs `kind="phi"`).
The two are **separate project data-items** that never interact; they only share
the UI so the interaction feels identical. The only behavioral differences are
data-driven (§4).

| Aspect | `kind="phius"` | `kind="phi"` |
| --- | --- | --- |
| Dataset roster queried | the seeded **Phius** dataset (provider `phius`, pinned version) | the seeded **PHI** dataset (provider `phi`, pinned version) |
| Proximity semantics | **hard gate** — pass iff ≤ 50 mi **AND** ≤ 400 ft (D-CL-17) | **advisory** — distance/Δelev shown; soft 50 mi/400 ft warning, no pass/fail block |
| Selecting a far option | allowed with explicit warning → attaches `status:"fail"`, surfaces the custom-set CTA (§8, O-DP-2) | allowed; attaches `status:"warning"`, "confirm representativeness w/ certifier" |
| Attached row | `project_climate_source` `kind="phius"` | `project_climate_source` `kind="phi"` |

Everything else — layout, state filter, map, list, select→preview→attach — is
identical and shared.

## 4. Data & endpoints

### 4.1 What already exists (reused unchanged)

- **Dataset roster.** `climate_dataset` (one row per `provider`+`version`) and
  `climate_dataset_location` (`name, country, region, climate_zone, latitude,
  longitude, elevation_m, station_id, data`=full `ClimateRecord`). `region`
  holds the **state code** → filtering a kind's stations by state is already a
  query. Indexed `(dataset_id, country, region)` and `(dataset_id, lat, long)`.
- **Proximity math.** `backend/features/climate/proximity.py::build_proximity_payload(...)`
  → `{distance_mi, elevation_delta_ft, status, message}` (haversine; the
  authoritative 50 mi/400 ft gate). Today it runs only for the single
  auto-nearest station.
- **Attach.** `POST /api/v1/projects/{id}/climate/sources` with
  `{kind, ref=location_id, label, data}` already attaches a chosen dataset
  location as a source, with the partial-unique default constraint.
- **Locations listing.** `GET /api/v1/climate/datasets/{dataset_id}/locations?region=&near=&limit=&offset=`
  filters by region and orders by `near`, but **does not return per-row
  distance/Δelev** — and the frontend may not compute it (hard rule: all
  calculations live in the backend).

### 4.2 What's new (Phase 1)

1. **A project-scoped dataset-roster endpoint** that returns each candidate
   station *with its proximity to this project*, sorted nearest-first:

   ```
   GET /api/v1/projects/{project_id}/climate/datasets/{kind}/locations?region=ST
       kind ∈ {phius, phi};  region optional (default = project's derived state)
   →  {
        dataset: { id, provider, version, label },
        project: { latitude, longitude, elevation_m, state },
        items: [ {
          id, name, station_id, latitude, longitude, elevation_m, climate_zone,
          proximity: { distance_mi, elevation_delta_ft, status, message }
        }, ... ]  // sorted by distance_mi asc
      }
   ```

   It resolves the pinned dataset for `kind`, lists that dataset's locations in
   `region` (or a `near`-ordered "any state" set when `region` is omitted —
   O-DP-3), and runs `build_proximity_payload` per location against the
   project's location. This is the **single authoritative feed** the modal
   renders: the frontend plots pins from lat/long and prints the
   backend-computed distances; it computes no proximity itself.

2. **Server-authoritative proximity on manual attach.** When a `phius`/`phi`
   source is POSTed with a `ref` (location_id), the backend **recomputes** the
   proximity payload (`build_proximity_payload`, `auto_attached: false`) rather
   than trusting client `data`. Keeps the stored gate honest and matches how
   auto-attach already writes the payload.

No schema change — proximity lives in the existing `data` JSONB (D-CL-14).

## 5. Modal UX

`ClimateDatasetPickerModal({ projectId, kind, onClose })`, in `ModalDialog`:

- **Header:** "Select Phius climate dataset" / "Select PHI climate dataset".
- **State filter:** a state `<select>` defaulting to the project's derived
  state; changing it refetches the roster. A "Nearest to project (any state)"
  option uses the `near` mode (O-DP-3) — important for border sites.
- **Map (left/top):** the project pinned at center, every roster station pinned
  around it, each pin colored by its proximity (pass = success, fail/warn =
  danger/warning); a **50 mi** limit ring anchors the Phius gate visually.
  Hovering/selecting a list row highlights its pin and vice-versa. Renders on a
  real MapLibre/MapTiler basemap (§6; O-DP-1 resolved), with a key-less fallback.
- **List (right/bottom):** one row per station, **sorted nearest-first** —
  station name · `distance_mi` · `Δelevation_ft` · climate zone · a status chip
  (Phius pass/fail LED; PHI distance advisory). Reuses the existing
  `ClimateStatusChip`/`ClimateTypeBadge` atoms so it matches the tab.
- **Select → preview → attach:** selecting a row previews its proximity verdict;
  a primary **Attach** (or **Replace current dataset** when one is already
  attached) commits via the attach mutation and closes. **Cancel** discards.
- **No-location guard:** if the project has no coordinates yet, the modal shows
  "Set the project location first" with a button that opens the Set Location
  modal — proximity is undefined without a site.

### 5.1 Entry points

- **Primary:** a button in the Phius/PHI page `SourceHeader` — **Select dataset**
  when none is attached, **Change dataset** when one is.
- **Missing-source card:** the sidebar "Not set" card's `add →` opens the picker
  pre-filtered to that kind (instead of the generic add page).
- **Fail page:** the existing "Browse datasets to override" link opens the
  picker for `kind="phius"`.
- The generic `ClimateDatasetBrowser` is **retired for phius/phi** in favor of
  this modal (the better D-CL-24 realization); the "＋ Add source" page keeps
  ASHRAE / EPW / custom-record attach, which the picker does not cover (O-DP-4).

## 6. The map (O-DP-1 → resolved: real basemap)

> **Superseded + shipped (D-DP-6, P2b 2026-06-22):** the renderer is **vanilla
> Leaflet** and tiles are **keyless OSM raster** — **not** MapLibre/MapTiler — so
> **O4 is dissolved** (no key, no proxy, no committed secret; MapTiler stays for
> geocoding only). Read "MapLibre/MapTiler", "the MapTiler key", and "before P2
> ships / O4 on the critical path" below as the historical O-DP-1 framing; the
> **product behaviour** (project pin, proximity-coloured station pins, 50 mi
> ring, pin ↔ row selection, key-less fallback) is unchanged and is what shipped.
> See `decisions.md` D-DP-6 and `phases/phase-02` Outcome — P2b.

Ed chose the **real MapLibre/MapTiler basemap from the start** (2026-06-21), not
a schematic. The picker map is a `<ClimateMap>` rendering MapLibre GL + MapTiler
tiles, with the **project pin**, **station pins** (colored by proximity status),
and the **50 mi Phius limit ring** as a GeoJSON circle. Selecting a list row
highlights its pin and vice-versa.

Consequences:

- **O4 is now a precondition of the frontend phase (P2), not a later
  enhancement.** Before P2 ships: provision the MapTiler key (already in backend
  `Settings`, used today for geocoding — confirm tile-usage terms + budget); add
  the map dependency (MapLibre GL JS / `@maptiler/sdk`) through the pnpm
  supply-chain gate (24 h min-age, strict, `blockExoticSubdeps`); serve tiles via
  a backend proxy or referrer-scoped key so **no key is committed** (public repo).
- **Key-less fallback (engineering, not a product downgrade).** `<ClimateMap>`
  renders the basemap when configured and degrades to a plain positioned-pin
  backdrop (sharing the same pin-placement helper) when no key is present, so CI,
  vitest, and key-less dev still work; tests assert against the fallback.
- **P3 retrofits the app's other decorative maps** (Location page, sidebar, Set
  Location pin-drop) to the same `<ClimateMap>`, closing O4 app-wide. P3 is now
  "spread the basemap everywhere," not "introduce it."

Pin placement is display geometry from lat/long; all distances/verdicts come
from the backend (§4), never recomputed client-side.

## 7. Privacy & access

- **Editor-only.** Attaching/replacing a dataset is an editor action; the picker
  button is gated like the other source actions (`access_mode === "editor"`).
- The picker shows only **public** geodata (station lat/long, the project's
  public coords) — no street address — so it inherits the D-CL-13 posture with
  nothing new to gate.

## 8. Proximity semantics & the failing-selection question (O-DP-2)

- **Phius:** the picker shows pass/fail per station against the published
  50 mi / 400 ft gate (D-CL-17). The honest question is what happens when the
  editor deliberately selects a **failing** station. Recommended: **allow with
  an explicit warning** — attach with `status:"fail"`, and route the page to the
  fail state (custom-set $75 CTA), because a failing station is often a useful
  *working* basis during design while the custom set is commissioned. (Alt:
  hard-block selection of failing stations.)
- **PHI:** advisory only — any selection attaches; the page shows distance/Δelev
  and the "confirm representativeness with certifier" note. No block.

## 9. Reuse vs. net-new

- **Reused:** `climate_dataset` / `climate_dataset_location` + region filter;
  `proximity.build_proximity_payload`; the attach/CRUD mutation +
  `project_climate_source`; `ClimateStatusChip` / `ClimateTypeBadge` /
  `ModalDialog`; the derived project location.
- **Net-new:** the project-scoped roster endpoint + per-location proximity +
  server-authoritative attach (P1); the generic `ClimateDatasetPickerModal` +
  the `<ClimateMap>` MapLibre/MapTiler basemap (with key-less fallback) + state
  filter + select/attach, plus the entry-point wiring and `ClimateDatasetBrowser`
  retirement (P2, gated on O4); the app-wide map retrofit (P3).

## 10. Acceptance gates (per phase — detail in `phases/`)

- **P1:** the roster endpoint returns a state's stations for a `kind` with
  correct backend-computed `distance_mi`/`elevation_delta_ft`/`status`, sorted
  nearest-first; manual attach recomputes proximity server-side
  (`auto_attached:false`); focused pytest covers the gate math + sort +
  attach; `make ci` green.
- **P2 (gated on O4):** from the Phius page and the PHI page, the picker opens,
  filters by state (default project state + "any state" mode), plots the project
  + stations on the MapLibre/MapTiler basemap with proximity-keyed pins and the
  50 mi ring, lists stations nearest-first with correct chips, and attaches the
  chosen one (replacing any current one; failing-Phius allowed with warning →
  fail status + custom-set CTA); key-less fallback keeps CI green; viewer/editor
  gating holds; the old browser is retired for phius/phi; vitest + Playwright +
  `make ci` green.
- **P3:** the app's other decorative maps (Location page, sidebar, Set Location
  pin-drop) adopt the same `<ClimateMap>`; `make ci` green. O4 closed app-wide.

## 11. Out of scope

- **Re-seeding / version-switching** the Phius/PHI datasets (admin flow stays
  deferred; O5). The picker operates within the pinned dataset version per kind.
- **ASHRAE / EPW / custom** attach — those keep their existing forms on the
  "＋ Add source" page; the picker is PH-dataset-only.
- **Non-US** datasets / international geocoding (US-first, as in the parent
  feature).
- **PHI dataset seeding** for the dev DB (only Phius/NY is seeded today) — a
  data/ops dependency for exercising the PHI instance, not a code item.
