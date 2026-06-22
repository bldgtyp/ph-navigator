---
DATE: 2026-06-21
TIME: 13:17 EDT
STATUS: Complete — implemented on branch; CI green; live smoke passed
AUTHOR: Ed (via Claude)
SCOPE: P2 — auto-find, pin, and flag the nearest Phius and PHI dataset
  locations by certification proximity (#5–6). Mostly reuses the existing
  nearest-to-coords search; adds the haversine gate + auto-attach.
RELATED:
  - ../PRD.md §5 (#5–6), §6 (proximity rules), ../decisions.md (D-CL-17)
  - ../research.md §4 (the cert rules + citations)
  - backend/features/climate/ (seeded datasets + `near` search)
  - backend/features/project_climate_source/ (pin as a source)
---

# Phase 2 — Phius/PHI auto-pin + proximity flags

## Goal

From the project coordinates (P1), auto-pin the nearest Phius and PHI dataset
locations as `project_climate_source` rows, each annotated with **distance +
elevation difference**, and **flag** them against the certifier's rule.

## Why this is small

The app-wide `climate_dataset_location` table is **already seeded and already
searchable by nearest-to-coords** (the `near` param + service ranking). P2
reuses that and adds: the proximity math, the gate logic, and auto-attach.

## Scope

1. **Proximity computation.** For the nearest hit in each provider dataset,
   compute great-circle **haversine** distance (not the existing planar
   cos-lat ranking distance — that is fine for ordering, not for a pass/fail
   boundary) and `|site_elevation − station_elevation|`.
2. **Flag logic (D-CL-17 / research §4).**
   - **Phius (hard):** pass iff distance ≤ 50 mi **and** Δelev ≤ 400 ft; else
     flag "no Phius set within 50 mi / 400 ft — custom set required ($75)."
   - **PHI (advisory):** show distance + Δelev; soft-warn beyond 50 mi/400 ft
     with "confirm representativeness with certifier" (PHI has no hard rule;
     elevation is correctable in PHPP) — pending O1.
3. **Auto-attach.** Pin the nearest Phius + PHI location as sources (version
   pinned, D-CL-14), storing the computed distance/Δelev/flag in the source's
   `data`. Idempotent re-run updates rather than duplicates.

## Reuse

- `search_climate_locations(..., near=...)` and `climate_dataset_location`.
- `project_climate_source` create/update + JSONB `data`.

## New work

- A `proximity.py` helper (haversine + the gate rules, unit-tested in
  isolation — the cert numbers are load-bearing).
- The auto-attach orchestration (part of the derive service from P1).

## Tests

- pytest: haversine vs known distances; the Phius gate at the boundary
  (just-inside / just-outside 50 mi and 400 ft, and the "either fails" case);
  PHI advisory; idempotent re-run; a coordinate with **no** qualifying Phius
  set produces the custom-required flag.
- `make ci` green.

## Exit criteria

Nearest Phius/PHI auto-pinned with distance/Δelev; Phius pass/fail correct
against 50 mi/400 ft; PHI advisory present; re-run idempotent; CI green.

## Implementation notes (2026-06-21)

- Added `backend/features/climate/proximity.py` for haversine miles, meter to
  feet elevation delta, Phius hard gate, PHI advisory, and source metadata
  payload construction.
- `POST /api/v1/projects/{project_id}/location/derive` now auto-attaches or
  updates the nearest seeded `phius` and `phi` `project_climate_source` rows in
  the same transaction as derived geodata persistence.
- Phius/PHI climate sources now permit `data` so the pinned source carries
  dataset id/version, location id/name, station id, distance, elevation delta,
  status, and status message.
- Climate source roster rows render the proximity line and status color. The
  location derive controller explicitly refetches active source queries so the
  roster updates in the same editor session.

## Verification (2026-06-21)

- `cd backend && uv run ty check features/climate/proximity.py features/project_location/service.py features/project_climate_source/models.py tests/test_climate_proximity.py tests/test_project_location.py` — passed.
- `cd backend && uv run pytest tests/test_climate_proximity.py tests/test_project_location.py tests/test_project_climate_source.py` — 33 passed.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/lib.test.ts` — 11 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` — passed:
  same-session derive auto-attaches a Phius source and renders `27.1 mi · 266
  ft elev delta`. Dev DB only had Phius seeded; PHI auto-attach is covered by
  focused pytest with a synthetic `phi` dataset. Smoke project:
  `2877cd2c-06fb-495d-8d62-db87117f277b`; screenshot:
  `/tmp/phn-climate-p2-phius-source.png`.
- `make format` — passed.
- `make ci` — passed: backend `927 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.

## Open questions (phase-local)

- O1 (PHI flag policy) gates the exact PHI copy/behavior.
- O5: confirm the seeded Phius/PHI versions are a valid cert basis before
  flagging against them (a stale-version pin would mis-certify).
- O6: when Phius fails, do we surface the $75 custom-data request workflow +
  the (deferred) custom-record entry form here, or just warn?
