---
DATE: 2026-06-21
TIME: -
STATUS: Draft — planned, not started.
AUTHOR: Ed (via Claude)
SCOPE: P1 — backend feed for the picker: a project-scoped dataset-roster
  endpoint returning each station with its proximity to the project, plus
  server-authoritative proximity on manual attach.
RELATED:
  - ../PRD.md §4, §10; ../decisions.md D-DP-2, D-DP-3
  - backend/features/climate/ (repository.py, proximity.py, routes.py, models.py)
  - backend/features/project_climate_source/ (service.py, routes.py)
  - backend/features/project_location/service.py (auto_attach_certification_sources — the precedent)
---

# Phase 1 — Backend roster + authoritative attach

## Goal

Provide the **single authoritative feed** the picker renders, and make manual
attach compute proximity server-side. No frontend in this phase.

## Why backend-first

The hard rule is that all calculations live in the backend. The picker needs,
per station, the distance and Δelevation to *this* project and the pass/fail
verdict — none of which the frontend may compute. The math already exists
(`build_proximity_payload`); today it runs only for the single auto-nearest
station. P1 exposes it per-station for a state roster.

## Work

1. **Roster endpoint** (project-scoped, editor-readable):

   ```
   GET /api/v1/projects/{project_id}/climate/datasets/{kind}/locations
       path: kind ∈ {phius, phi}
       query: region (optional; default = project's derived state),
              near (bool, optional — "any state" nearest mode, O-DP-3),
              limit/offset (optional)
   →  { dataset:{id,provider,version,label},
        project:{latitude,longitude,elevation_m,state},
        items:[ {id,name,station_id,latitude,longitude,elevation_m,climate_zone,
                 proximity:{distance_mi,elevation_delta_ft,status,message}} ],  # nearest-first
        total }
   ```

   - Resolve the pinned `climate_dataset` for `provider==kind` (same selection
     auto-attach uses).
   - List that dataset's `climate_dataset_location` rows filtered by `region`
     (reuse the existing region filter / `(dataset_id, country, region)` index),
     or the `near`-ordered set when `region` omitted and `near` set.
   - For each, call `build_proximity_payload(provider, dataset, location,
     site_lat, site_lon, site_elev)`; sort by `distance_mi` asc.
   - **404/empty** cleanly when the kind's dataset isn't seeded (PHI in dev) —
     return `dataset:null, items:[]` with a reason, so the modal can show a
     "no PHI dataset available" state rather than erroring (O-DP-5).
   - **No location set** → 409/422 with a clear code the modal maps to its
     "set the project location first" guard.

2. **Server-authoritative attach.** In `project_climate_source` create (and/or a
   thin service helper), when `kind ∈ {phius, phi}` and `ref` is a dataset
   `location_id`, **recompute** the proximity payload server-side
   (`build_proximity_payload`, `auto_attached:false`) and persist that as `data`
   — ignoring/overriding any client-sent proximity. Keep `label` cached from the
   location name. (Mirrors `auto_attach_certification_sources` exactly, minus the
   nearest-search.)

3. **Reuse, don't duplicate:** factor the per-location proximity loop so both the
   roster endpoint and `auto_attach_certification_sources` call one helper (the
   nearest-finder becomes "roster + take first").

## Tests (pytest)

- Roster returns a seeded state's stations for `kind="phius"`, sorted
  nearest-first, each with correct `distance_mi`/`elevation_delta_ft`/`status`
  against a known project location (assert the gate boundary: a station at
  49 mi/390 ft passes, 51 mi or 410 ft fails).
- `region` default = project state; explicit `region` overrides; `near` any-state
  mode orders across regions.
- Unseeded kind → empty `dataset:null` (synthetic `phi`-absent case).
- No project location → the guard error code.
- Manual attach of a far Phius location persists `status:"fail"`,
  `auto_attached:false`; client-sent bogus `data` is overridden.

## Exit criteria

The endpoint feeds the modal with authoritative, sorted, per-station proximity;
manual attach stores a server-computed payload; proximity logic is shared with
auto-attach (no second implementation); focused pytest + `make ci` green.
