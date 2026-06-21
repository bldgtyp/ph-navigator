---
DATE: 2026-06-21
TIME: 13:02 EDT
STATUS: Complete — implemented on branch; CI green; visual smoke passed
AUTHOR: Ed (via Claude)
SCOPE: P1 — the address front-door: auth-gated address modal + MapTiler
  geocoding, and the keyless derive routines for lat/long, county/state,
  elevation, and climate zone (#1–4). Plus the privacy projection (D-CL-13).
RELATED:
  - ../PRD.md §3 (privacy), §5 (#1–4), ../decisions.md (D-CL-13,15,16)
  - ../research.md §1–3
  - backend/features/project_location/ (location store this extends)
  - frontend/src/features/projects/ (location editor/summary)
---

# Phase 1 — Address, geocoding, derived geodata

The foundation: everything downstream keys off the stored coordinates.

## Goal

Enter a site address in an **auth-gated modal**; pin lat/long (canonical key,
address optional); derive + store **county/state, elevation, climate zone**;
and project the public location **without** the address string.

## Scope

1. **Address modal (frontend, editor-only).** MapTiler autocomplete
   (`@maptiler/geocoding-control`) + a **drop-a-pin / reverse-geocode** map
   fallback for address-less rural sites (D-CL-15). Stores lat/long as the key;
   address string optional. Replaces hand-entry of raw coords as the primary
   path (raw-coord edit can remain as an advanced affordance).
2. **Derive service (backend, keyless/server-side).**
   - county + state FIPS/names — FCC Area API → Census Geocoder fallback.
   - elevation — USGS EPQS → Open-Meteo fallback (short timeout, then fallback).
   - climate zone — county FIPS → bundled **PNNL 2021 IECC CSV** lookup.
   - Each value stored on the location record (or `project_climate_source`
     where it belongs); each carries a derived-vs-manual provenance marker.
3. **Privacy projection (D-CL-13).** Public/viewer location response =
   `{ latitude, longitude, elevation_m, county, state, country, climate_zone }`
   — **address omitted**. The current `ProjectLocationSummary` (which exposes
   everything) is split so the address line is editor-only.
4. **Repo data.** Extract the PNNL shapefile once → `climate_zones.csv`
   (`county_fips_5, iecc_zone, ba_zone`), committed (public domain).

## Reuse

- `project_location` table + service + the existing EPW flow (unchanged here).
- Extend `project_location` storage for county/state/zone/address if columns
  are missing (small migration) — confirm current columns first.

## New work

- `backend/features/climate/derive/` (or extend the location service): the
  external clients + the county→zone CSV loader; all server-side, no secrets
  beyond an optional MapTiler key (geocoding can run client-side with a
  domain-restricted key, or via a thin backend proxy — decide in build).
- Frontend address modal + MapTiler component; the privacy-aware summary.

## Tests

- pytest: each derive routine with a fixture coordinate (e.g. a
  West-Stockbridge MA lat/long → Berkshire County, ~5A, plausible elevation);
  fallback path when the primary API errors/times out; county→zone CSV lookup.
- vitest/Playwright: address search resolves + pins; drop-a-pin fallback;
  **viewer DOM never contains the address string** (the privacy assertion).
- `make ci` green.

## Exit criteria

Address set in the modal pins lat/long; county/state/elevation/zone derived,
stored, and shown; public projection omits the address; fallbacks work; CI green.

## Implementation notes (2026-06-21)

- Added `project_location` storage for `county`, `county_fips`, `country`,
  `climate_zone`, and per-field `geodata_provenance` JSONB.
- Added editor-only `POST /api/v1/projects/{project_id}/location/geocode`
  (MapTiler-backed when `MAPTILER_API_KEY` is configured) and
  `POST /api/v1/projects/{project_id}/location/derive` (FCC→Census county,
  USGS→Open-Meteo elevation, PNNL 2021 IECC county-zone lookup).
- Added the committed PNNL-derived CSV at
  `backend/features/project_location/data/climate_zones.csv`; Berkshire County
  FIPS `25003` resolves to IECC `5A`.
- External JSON fetches use the backend venv's `certifi` CA bundle explicitly;
  this keeps FCC/Census/USGS HTTPS calls working under the `uv` Python runtime.
- Split the public location projection behavior by route access:
  anonymous/viewer reads keep public coordinates/geodata but return
  `site_address: null`; signed-in editors still see the address.
- Frontend Climate location editor now supports address lookup candidates,
  manual pin/coordinate fallback, and a `Populate climate data` action that
  persists derived geodata.

## Verification (2026-06-21)

- `cd backend && uv run pytest tests/test_project_location.py` — 15 passed.
- `cd backend && uv run ruff check features/project_location tests/test_project_location.py config.py alembic/versions/20260621_0032_project_location_derived_geodata.py` — passed.
- `cd backend && uv run ty check features/project_location tests/test_project_location.py config.py` — passed.
- `cd frontend && pnpm exec vitest run src/features/projects/__tests__/location-form.test.ts src/features/projects/components/__tests__/ProjectSettingsModal.location.test.tsx src/features/climate/__tests__/ClimateSourcesSection.test.tsx` — 11 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- `make format` — passed.
- `make ci` — passed: backend `918 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` — passed:
  editor manually pins West Stockbridge coordinates, `Populate climate data`
  persists `Berkshire County` and `5A`; anonymous/mobile viewer DOM shows public
  county/zone and omits `16 Main Street, West Stockbridge, MA`. Smoke project:
  `f82cd588-d1c5-4579-80c0-47cf7d02888e`; screenshots:
  `/tmp/phn-climate-p1-editor.png`, `/tmp/phn-climate-p1-viewer.png`.

## Open questions (phase-local)

- MapTiler key placement resolved for this slice as a backend proxy keyed by
  `MAPTILER_API_KEY`; O4 procurement remains operational.
- Storage resolved as columns for durable public geodata plus JSONB provenance.
- O4 (commercial keys) still applies before production reliance on MapTiler /
  Open-Meteo free tiers.
