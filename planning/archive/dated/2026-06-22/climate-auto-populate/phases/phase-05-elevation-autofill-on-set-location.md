---
DATE: 2026-06-22
TIME: 13:25 EDT
STATUS: Complete — merged to main (2026-06-22, commit 21439428); CI green
AUTHOR: Ed (via Claude)
SCOPE: Auto-populate site elevation inside the Set Location modal the moment
  coordinates are set (address candidate, pin-drop, or valid manual lat/long),
  while keeping the existing Advanced elevation input as a user override. Adds a
  lightweight, side-effect-free elevation-only lookup endpoint; does NOT bundle
  the heavy `Locate Climate Data` derive back into the modal.
RELATED:
  - ../README.md — feature scope + phase map
  - ../STATUS.md — "Set Location modal scope split (2026-06-22)"
  - ../decisions.md — D-CL ledger (this phase added D-CL-27..29, accepted)
  - phase-01-address-geocoding-derived-geodata.md — built the derive endpoint + elevation derivation
  - backend/features/project_location/derive.py — `fetch_elevation_geodata` (reused)
  - backend/features/project_location/service.py — `derive_project_location` (NOT reused here, and why)
  - frontend/src/features/climate/components/SetLocationModal.tsx — the modal
  - frontend/src/features/projects/useProjectLocationForm.ts — form controller
  - frontend/src/features/projects/location-form.ts — value mapping/validation
---

# Phase 05 — Elevation auto-fill on Set Location

## Problem

When a user sets a site location through the **Set Location modal**, elevation
does **not** auto-populate. It stays blank (persisted as `NULL`) unless the user
manually types it in the Advanced section, applies an EPW file, or goes to the
Location page and clicks **Locate Climate Data**. Latitude/longitude get set,
but the elevation right beside them is left empty — the one derived value the
user most expects to fall out of "I just told you where the building is."

The backend can already resolve elevation accurately (USGS 3DEP → Open-Meteo).
The gap is purely that this capability is wired only into the **heavy** derive
flow on the Location page, not into the **lightweight** Set Location modal that
owns the elevation field.

## Current state (verified 2026-06-22)

**Backend — elevation derivation already exists and is good.**
- `fetch_elevation_geodata(lat, lon, fetch_json)` tries **USGS EPQS** first,
  then **Open-Meteo** as fallback, returning `(ElevationGeodata | None, warning)`
  — `backend/features/project_location/derive.py:226-239`.
  - USGS URL: `derive.py:348-350` · Open-Meteo URL: `derive.py:353-355`.
  - Robust parsing incl. the USGS missing-data sentinel — `derive.py:298-316`.
- This is exposed **only** through `POST …/location/derive`
  (`routes.py:56-65` → `service.derive_project_location`, `service.py:98-154`),
  which also **persists** and triggers heavy side effects: county + climate-zone
  lookup, EPW/ASHRAE weather-source preparation, and
  `auto_attach_certification_sources` / `auto_attach_weather_sources`
  (`service.py:133-140`). That is deliberately a Location-page action, not a
  modal action (see STATUS "Set Location modal scope split").
- `PUT …/location` (`routes.py:45-53` → `service.update_project_location`)
  persists whatever fields are sent, including `elevation_m`. No auto-fetch.

**Frontend — the modal never auto-derives.**
- `SetLocationModal` Save → `form.save()` → `useUpdateProjectLocationMutation`
  → `PUT …/location` — it persists the elevation field's *current* string
  (blank unless typed). `SetLocationModal.tsx:73-81`, `useProjectLocationForm.ts:137-144`.
- Pin-drop sets lat/long only — `SetLocationModal.tsx:49-52`.
- Geocode-candidate apply sets lat/long/address but **explicitly not elevation**
  — `location-form.ts:82-94`.
- EPW apply **does** set elevation from the EPW header — `location-form.ts:96-116`
  (this is the existing precedent for "fill the elevation string from a derived
  metres value in the current unit system").
- The only auto-derive path today is the Location page's **Locate Climate Data**
  button → `deriveForm.deriveLocation()` → `POST …/derive`
  — `ClimateTab.tsx:143`, `useProjectLocationForm.ts:123-135`.

**Net:** the modal already *displays and edits* elevation
(`SetLocationModal.tsx:175-183`); it just never *fills* it.

## Goal / behavior contract

> When a site location is set, elevation auto-populates. The user can always
> override it, and override is sticky.

1. **Auto-fill on coordinate change.** When coordinates become a new valid
   `(lat, lon)` via (a) geocode-candidate apply, (b) map pin-drop, or (c) a
   valid manual lat/long edit, the modal fetches elevation and fills the
   Advanced elevation input (formatted to the active IP/SI unit).
2. **Override wins and sticks.** Once the user edits the elevation field by
   hand, auto-fill stops clobbering it. A small **"↻ Reset to auto"** affordance
   re-enables auto and re-pulls. (Keep the existing input exactly as-is — this
   is the override affordance the user asked us to preserve.)
3. **Never block.** Lookup is best-effort: a failure or "no data" leaves the
   field editable with a quiet inline note; Save is never gated on it.
4. **No surprise side effects.** Setting a location must not auto-attach climate
   or certification sources — that stays the explicit Location-page action. The
   modal's scope split (2026-06-22) is preserved.
5. **Existing save path unchanged.** Whatever ends up in the elevation field
   (auto or overridden) is persisted by the existing `PUT …/location`.

## Design

### Backend — a lightweight, side-effect-free elevation lookup

Add an elevation-only endpoint that reuses the existing resolver but **persists
nothing and attaches nothing**:

- **Route:** `POST /api/v1/projects/{project_id}/location/elevation`
  (`routes.py`). Editor access, matching `/geocode` and `/derive`.
- **Request:** new minimal `ElevationLookupRequest { latitude: float; longitude: float }`
  in `models.py`, reusing `validate_latitude` / `validate_longitude`.
- **Response:** new `ElevationLookupResponse { elevation_m: float | None;
  source: str | None; warning: str | None }`.
- **Service:** `lookup_site_elevation(latitude, longitude)` in `service.py` →
  calls `fetch_elevation_geodata(lat, lon, fetch_json_url)` and maps the
  `(ElevationGeodata | None, warning)` tuple straight onto the response. No
  `transaction()`, no `asset_service`, no auto-attach.

Why this shape (accepted decisions):

- **D-CL-27 — new elevation-only endpoint, do NOT reuse `/derive`.** `/derive`
  persists county/zone and auto-attaches weather + certification sources
  (`service.py:117-140`). Calling it from the modal would re-bundle the heavy
  work the 2026-06-22 scope split deliberately pulled out, and would mutate
  project state on a transient coordinate hover/pin. The modal needs *only*
  elevation, with no writes. A separate endpoint keeps the split intact and the
  call cheap (one external GET, no DB).
- **D-CL-28 — keep the lookup in the backend, not a direct client→USGS call.**
  Hard rule: all data manipulation lives in the backend. It also keeps the
  USGS→Open-Meteo fallback, sentinel handling, timeout, and User-Agent in one
  place (`derive.py`), avoids browser CORS/commercial-tier exposure, and lets us
  later swap providers without touching the client.
- **D-CL-29 — project-scoped + editor-gated, even though elevation is
  project-independent.** Scoping to `{project_id}` reuses
  `require_project_edit_access` and avoids standing up an unauthenticated
  external-proxy endpoint that could be abused as an open elevation proxy.

*Out of scope for the endpoint:* no MCP tool (the modal flow is interactive;
the full `/derive` MCP tool already covers programmatic derivation), and no
county/climate-zone in the response — that belongs to `/derive`.

### Frontend — wire auto-fill into the form controller, keep the override

All logic lands in `useProjectLocationForm` + `location-form.ts`; the modal
markup barely changes.

1. **API + hook.** `lookupElevation(projectId, lat, lon)` in `projects/api.ts`;
   `useLookupElevationMutation(projectId)` in `projects/hooks.ts` (no cache
   writes — it returns a value, it doesn't mutate server state).
2. **Override flag.** Add an `elevationOverridden` ref to the controller:
   - set `true` when `updateField("elevation", …)` is called by the user;
   - reset to `false` on server load (`locationFormValuesFromLocation`) and when
     the user clicks **Reset to auto**.
3. **Auto-fill trigger.** A small helper `autoFillElevation(lat, lon)` that:
   - returns early if `elevationOverridden.current` is `true`;
   - calls the lookup, and on a non-null result writes the elevation string via
     the **existing** `formatNumberUnitsDisplay(elevation_m,
     LOCATION_ELEVATION_UNITS, unitSystem)` path (same as EPW apply,
     `location-form.ts:106-110`), recording `elevationSource`
     (e.g. `usgs_epqs` → "USGS 3DEP", `open_meteo` → "Open-Meteo");
   - on null/failure, sets a quiet `elevationNote` and leaves the field.
   Call it from: `applyGeocodeCandidate`, `dropPin` (via the controller), and a
   **debounced** (~600 ms) watcher on valid manual `(lat, lon)` changes that
   differ from the last looked-up pair.
4. **Status surface (modal).** Beside the elevation input show one of:
   *"Looking up…"*, *"Auto · USGS 3DEP"* (or Open-Meteo), or the quiet note
   *"Couldn't auto-detect — enter manually."* When overridden, show
   **"↻ Reset to auto"**. The input itself is unchanged.
5. **Initial-open behavior.** Do **not** re-pull for an already-saved location
   whose coordinates haven't changed — respect the stored elevation (mirrors the
   backend's `clear_derived_geodata_if_coordinates_change` philosophy). Auto-fill
   fires only on a *change* of coordinates within the session.

### Data flow (after)

```
pick candidate / drop pin / valid manual lat-long
        │  (elevationOverridden? → stop)
        ▼
POST …/location/elevation {lat, lon}     ← new, no writes
        │  fetch_elevation_geodata: USGS EPQS → Open-Meteo
        ▼
{elevation_m, source, warning}
        ▼
fill Advanced elevation input (IP/SI formatted) + "Auto · <source>"
        ▼
user may overtype  → elevationOverridden = true  (sticky)
        ▼
Save → existing PUT …/location persists elevation_m (auto or overridden)
```

## Test plan

**Backend** (`backend/tests/test_project_location.py`):
- USGS success → `elevation_m` from EPQS, `source="usgs_epqs"`, no warning.
- USGS fails → Open-Meteo fallback returns value, `source="open_meteo"`.
- Both fail → `elevation_m=None` + the existing warning string; HTTP 200.
- Lat/long validation rejects out-of-range; endpoint requires editor access.
- Assert **no** DB write and **no** source attachment occur (the side-effect
  contract vs `/derive`).

**Frontend**:
- `useProjectLocationForm` / `location-form` units: candidate-apply and pin-drop
  fill the elevation string in the active unit; manual override sets the sticky
  flag and blocks subsequent auto-fill; **Reset to auto** clears the flag and
  re-pulls; failed lookup leaves the field editable and shows the note.
- `SetLocationModal.test.tsx`: pin-drop (mocked lookup) populates elevation;
  type a manual elevation, then drop a new pin → value is **not** clobbered.

## Out of scope

- County / climate-zone / source auto-attach in the modal — stays the
  Location-page **Locate Climate Data** action (`/derive`).
- International elevation (US-first; USGS is US-only, Open-Meteo is the global
  backstop already in place).
- An MCP tool for elevation-only lookup.

## Closeout gate

`simplify` + `docs-pass` on the diff, `make format`, then `make ci` (backend +
frontend). Accepted D-CL-27..29 are folded into `../decisions.md`; `../STATUS.md`
and the README phase map are updated in the same docs pass.
