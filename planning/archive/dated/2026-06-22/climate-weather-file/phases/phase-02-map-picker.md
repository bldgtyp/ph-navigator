---
DATE: 2026-06-22
TIME: 20:35 EDT
STATUS: ✅ Shipped (2026-06-22) — backend roster + from-catalog attach; a
  dedicated `WeatherStationPickerModal` reusing `ClimateMap` (neutral pin, no
  cert gate). Backend + frontend tests green.
AUTHOR: Claude (for Ed)
SCOPE: P2 — the epwmap-style "Select from map" station picker for the weather
  source: an EPW-catalog roster + from-catalog attach, reusing the PH picker's
  map/state-filter/list UX with the cert gate removed.
RELATED:
  - ../PRD.md §3 (D4/D6), §5.5–5.6 (backend), §6.2 (frontend)
  - backend/features/climate/epw_catalog.py (catalog + nearest)
  - backend/features/project_climate_source/{models,service,routes}.py
    (PH roster precedent: get_project_dataset_roster)
  - frontend/src/features/climate/components/{ClimateDatasetPickerModal,
    ClimateMap}.tsx
---

# Phase 2 — "Select from map" station picker

## Goal

Give the Weather File page a **map picker** styled like the PHI/PHIUS one: a USA
basemap with the project pin, a **state filter**, a proximity-ranked station
list (distance / Δelev), and attach-on-pick. Picking a station downloads +
parses + stores it exactly as the auto-derive does. Delivers the marquee of ask
**#2**. No certification gate (D4) — distance/Δelev is informational.

## Design note — reuse the existing picker

`ClimateDatasetPickerModal` + `ClimateMap` already render this UX for PH. Two
ways to add weather mode:
- **(Recommended) Extract a shared `StationPickerLayout`** (modal shell + state
  filter + `ClimateMap` + list) and keep two thin wrappers: the PH variant
  (proximity verdict chips + 50 mi ring) and the weather variant (distance/Δelev,
  no gate). Avoids littering the body with `if (kind === "weather")`.
- (Alt) Parametrize the existing modal with a `mode`. Faster, but grows
  conditionals. Decide in build; prefer extraction if the conditionals exceed ~3.

## Scope

### Backend

- `epw_catalog.py` — add roster helpers over the cached catalog (in-memory, no
  re-download):
  - `epw_entries_for_region(*, country, region, limit)` — filter by country +
    state; compute `distance_mi` per entry when a site is given.
  - `nearest_epw_entries(latitude, longitude, *, limit)` — nearest-first across
    the (optionally country-filtered) catalog (generalizes `nearest_epw_entry`).
  - `find_entry_by_url(url)` — resolve a catalog entry from its zip URL (for the
    from-catalog attach), since `download_epw_zip` needs an `EpwCatalogEntry`.
  - **Confirm the catalog's country/region values** — `country` (is it `"USA"`?)
    and `region` (state code vs name). `US_STATES` carries code+name; the roster
    filter must match whatever the XLSX `state` column uses (likely a code).
- `project_climate_source/models.py` — `EpwRosterItem` (name, wmo, latitude,
  longitude, elevation_m, distance_mi, elevation_delta_ft, region, source_url)
  and `EpwRosterResponse` (project origin + items + total). **No proximity
  verdict** (D4).
- `project_climate_source/service.py`:
  - `get_project_epw_roster(project_id, *, region, near, limit)` — reuse
    `_load_project_site` (location required, like the PH roster), filter the
    catalog by `region` (default = site state) or `near`, compute distance +
    elevation delta vs site, return nearest-first.
  - `attach_weather_source_from_catalog(project_id, url, user, request)` —
    `find_entry_by_url` → `download_epw_zip` → `build_weather_source_payloads`
    (P1 already emits a single weather source) → `auto_attach_weather_sources`;
    audit. Also updates `project_location.epw_asset_id`/`epw_source_url` (parity
    with derive) until P3 consolidates that.
- `project_climate_source/routes.py`:
  - `GET /{project_id}/climate/epw-roster?region=&near=&limit=` → `EpwRosterResponse`.
  - `POST /{project_id}/climate/sources/weather/from-catalog` `{url}` →
    `ProjectClimateSourcePublic`.

### Frontend

- `api.ts` / `hooks.ts` — `fetchEpwRoster`, `useEpwRosterQuery(projectId, region)`
  (keyed by `[projectId, "epw-roster", search]`); `attachWeatherFromCatalog`
  mutation (invalidates the sources query, like `useCreateClimateSourceMutation`).
- `types.ts` — `EpwRosterItem`, `EpwRosterResponse`, `EpwRosterSearch`.
- Picker — weather variant (per the design note):
  - feed from `useEpwRosterQuery`; map items → `ClimateMap` markers; **hide
    `limitRingMeters`** and the verdict chip; list rows show
    `distance_mi` + `Δelev` (+ region), no Zone/verdict.
  - selection preview shows distance/Δelev text (no cert message).
  - attach → `attachWeatherFromCatalog({ url })` then close + select the source.
- `ClimateMap.tsx` — confirm station markers render **without** a `status`
  (today `stations[].status` may be required); make it optional / default
  neutral for weather mode.
- `ClimateTab.tsx` — hoist weather-picker open state (mirror `pickerKind`); open
  it from the Weather page "Select from map" button + the empty-state.
- Weather page — add the **"Select from map"** button to the actions row,
  alongside the existing "Set from nearest" (P1).

## Tests

- backend: roster filters by state (fixture catalog); nearest mode; elevation
  delta math; `from-catalog` downloads+parses+upserts a single weather source
  (mock the zip bytes). Location-required guard returns 409.
- frontend: vitest — weather picker renders map + list, no verdict chip / ring;
  selecting + attaching calls the from-catalog mutation; PH picker unchanged
  (regression). `tsc --noEmit` clean.
- `make ci` green; Playwright visual — open "Select from map", filter by state,
  pick a station, see it attached.

## Exit criteria

"Select from map" opens a USA/state-filtered station picker (PH-picker-styled,
no cert gate); picking a station attaches the weather source via download +
parse + store; the PH picker is unregressed; CI green.

## Risks / checks

- **Catalog country/region normalization** — USA label + state code-vs-name; the
  single most likely source of an empty roster. Add a tiny mapping if needed.
- **Catalog size/perf** — 17k rows filtered in-memory per call is fine behind the
  24h cache; do not re-download per request. Cap page size (`_MAX_PAGE_SIZE`
  precedent).
- **Picker generalization regressing PH mode** — keep the PH verdict path
  byte-for-byte; cover with the existing PH picker test.
- **`ClimateMap` status optionality** — verify before assuming markers render
  without a status.
