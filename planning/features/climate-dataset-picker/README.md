---
DATE: 2026-06-22
TIME: -
STATUS: All phases DONE (P1–P4, 2026-06-22) — P1 (backend roster + attach), P2a
  (key-less picker scaffold), P2b (live vanilla-Leaflet + keyless-OSM basemap),
  P3 (app-wide map retrofit), P4 (PHI dev seed + verification). O4 dissolved +
  closed app-wide (D-DP-6); O-DP-1..5 resolved. One open item: O-DP-6 (PHI
  region-filter vocabulary mismatch, found during P4 verification).
AUTHOR: Ed (via Claude)
SCOPE: Manual climate-dataset picker — a map + state-filter modal to browse and
  attach a PH climate dataset, opened independently from the Phius and PHI
  pages (shared UI, separate project data-items). Manual-override counterpart to
  climate-auto-populate's address-derived attach.
RELATED:
  - PRD.md — product / behavior contract
  - decisions.md — provisional decisions (D-DP-*) + open questions (O-DP-*)
  - STATUS.md — current state, next step
  - phases/ — phased implementation plans
  - planning/features/climate-auto-populate/ — the auto-attach this complements
  - backend/features/climate/, backend/features/project_climate_source/
  - frontend/src/features/climate/
---

# Climate Dataset Picker — Feature Folder

## Scope

`climate-auto-populate` makes the climate basis **address-driven**: enter the
site address and the nearest Phius/PHI/ASHRAE/EPW sources auto-attach. This
feature adds the **explicit manual counterpart for the two PH datasets** — a
map + state-filter modal where an editor browses the available Phius (or PHI)
stations for a state, sees each one's proximity to the project, and attaches the
one they want.

It is the concrete realization of two things the parent feature deferred:
D-CL-24 ("the dataset browser demotes to a manual add/override surface") and O6
("the custom-set / override outcome"), and it forces the O4 map decision.

## The shape in one paragraph

One generic `ClimateDatasetPickerModal(kind)` component, mounted **twice and
independently** — `kind="phius"` from the Phius page, `kind="phi"` from the PHI
page. Each attaches to its own `project_climate_source` row; they share only the
UI. A new project-scoped backend endpoint returns a state's stations for a kind,
each with backend-computed distance/Δelevation/pass-fail (honoring "all
calculations live in the backend"). The map is a real **vanilla-Leaflet +
keyless-OSM-raster basemap** (D-DP-6, superseding the original MapLibre/MapTiler
call) with the project pin, station pins, and the 50 mi limit ring — so **O4 is
dissolved** (no key, no proxy, no committed secret); a `placePins` fallback
keeps CI/tests working and serves the deterministic unit-test path.

## Read order

1. `PRD.md` — user story, the one-component/two-instances model, data &
   endpoints, modal UX, the map decision, proximity semantics.
2. `decisions.md` — decisions (D-DP-1..6; O-DP-1..5 resolved) and the remaining
   **open question** (O-DP-6 PHI region-filter vocabulary mismatch).
3. `STATUS.md` — current state and next step.
4. `phases/` — implementation plans in dependency order.

## Phase map

| Phase | Status | Title | Gist | Depends on |
| --- | --- | --- | --- | --- |
| P1 | ✅ DONE | Backend roster + authoritative attach | Project-scoped `…/datasets/{kind}/locations` with per-station proximity, sorted nearest-first; server-recomputed proximity on manual attach | — |
| P2a | ✅ DONE | Key-less picker scaffold | Generic `ClimateDatasetPickerModal(kind)`: state filter (default state + any-state), key-less map fallback, nearest-first list, select→attach (failing-Phius allowed w/ warning); entry points; browser retired for phius/phi | P1 |
| P2b | ✅ DONE | Live basemap | Layered the **vanilla-Leaflet + keyless-OSM-raster** basemap + 50 mi ring into `<ClimateMap>` behind the `placePins` fallback (D-DP-6); O4 dissolved | P2a |
| P3 | ✅ DONE | App-wide map retrofit | `<ClimateMap>` generalized into the app's one shared map; adopted by the Location big map, sidebar mini-map (static), and Set-Location pin-drop; O4 closed app-wide | P2 |
| P4 | ✅ DONE | PHI dataset seed + PHI picker verification | Dev seed now seeds **every** published provider (prod's `seeding --all` path) — `phi/10.6` lands locally, nearest PHI station pinned; PHI picker + advisory semantics verified live (O-DP-5 resolved — was never data-blocked). Surfaced **O-DP-6** (PHI region-filter mismatch) | P1 |

P2 delivers the user's full ask. O4 is **dissolved** (D-DP-6: vanilla Leaflet +
keyless OSM raster — no key, no proxy, no committed secret); a `placePins`
fallback keeps CI/tests green and serves the deterministic unit-test path.

## Relationship to climate-auto-populate

This is a **sibling feature**, not a phase of the parent. It reuses the parent's
data model, proximity math, attach path, and UI atoms wholesale, and lands two
of its open items (O4, O6 / D-CL-24). Its decision ledger uses a **D-DP-*
prefix** and references D-CL-* where it builds on accepted parent decisions.

## Out of scope

See PRD §11 — dataset re-seeding/version-switching, ASHRAE/EPW/custom attach,
and non-US datasets are out of scope here. (PRD §11 also listed dev-DB PHI
seeding as out of scope; **P4 landed it** — the dev seed now seeds every
published provider, so PHI seeds locally alongside Phius.)
