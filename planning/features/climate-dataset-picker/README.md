---
DATE: 2026-06-21
TIME: -
STATUS: P1 DONE (backend roster + authoritative attach); P2 blocked on O4.
  O-DP-1..3 resolved (Ed, 2026-06-21)
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
calculations live in the backend"). The map is a real **MapLibre/MapTiler
basemap** (Ed's call, O-DP-1) with the project pin, station pins, and the 50 mi
limit ring — so O4 (key + vetted dep + budget) is on the critical path; a
key-less fallback keeps CI/tests working.

## Read order

1. `PRD.md` — user story, the one-component/two-instances model, data &
   endpoints, modal UX, the map decision, proximity semantics.
2. `decisions.md` — decisions (D-DP-1..5; O-DP-1..3 resolved by Ed) and the
   remaining **open questions** (O-DP-4 browser retirement, O-DP-5 PHI seed).
3. `STATUS.md` — current state and next step.
4. `phases/` — implementation plans in dependency order.

## Phase map

| Phase | Status | Title | Gist | Depends on |
| --- | --- | --- | --- | --- |
| P1 | ✅ DONE | Backend roster + authoritative attach | Project-scoped `…/datasets/{kind}/locations` with per-station proximity, sorted nearest-first; server-recomputed proximity on manual attach | — |
| P2 | ⛔ blocked on O4 | Picker modal + basemap | Generic `ClimateDatasetPickerModal(kind)`: state filter (default state + any-state), MapLibre/MapTiler basemap + station pins + 50 mi ring, nearest-first list, select→attach (failing-Phius allowed w/ warning); entry points; retire browser for phius/phi | P1 + **O4** |
| P3 | ◻ planned | App-wide map retrofit | Adopt the picker's `<ClimateMap>` for the Location / sidebar / Set-Location decorative maps; close O4 app-wide | P2 |

P2 delivers the user's full ask but is **gated on O4** (MapTiler key + a vetted
map dependency + a tiles budget) — now on the critical path, since Ed chose the
real basemap over a schematic. A key-less fallback keeps CI/tests green.

## Relationship to climate-auto-populate

This is a **sibling feature**, not a phase of the parent. It reuses the parent's
data model, proximity math, attach path, and UI atoms wholesale, and lands two
of its open items (O4, O6 / D-CL-24). Its decision ledger uses a **D-DP-*
prefix** and references D-CL-* where it builds on accepted parent decisions.

## Out of scope

See PRD §11 — dataset re-seeding/version-switching, ASHRAE/EPW/custom attach,
non-US datasets, and dev-DB PHI seeding are all out of scope here.
