---
DATE: 2026-06-21
TIME: -
STATUS: Planned
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

## Open questions (phase-local)

- MapTiler key placement: client-side domain-restricted vs. backend proxy.
- Whether to add columns or stash derived geodata in existing JSONB.
- O4 (commercial keys) applies here (MapTiler, Open-Meteo).
