---
DATE: 2026-06-13
TIME: -
STATUS: Planned — the climate-data foundation. Start after (or parallel
  to) Phase 1; required before the tab (Phase 3) and design conditions
  (Phase 4).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the standardized climate record + the
  app-wide, versioned Phius/PHI reference datasets + seed importers.
RELATED:
  - ../PRD.md §4 (data model + standardized record), §5.2
  - ../decisions.md (D-CL-8 reference datasets, D-CL-9 custom,
    D-CL-10 reuse PH-Tools)
  - ../research.md (example-data shape — the basis for the format)
  - example_data/phius_2022_climate_data/
  - example_data/phi_phpp_10_6_climate_data/
---

# Climate Phase 2 — Standardized format + reference datasets

The climate-data foundation: one canonical record, two app-wide
versioned reference stores (Phius, PHI), and seed importers. This is
what the tab (Phase 3) and the design-conditions contract (Phase 4)
build on.

## 1. Required reading

- `../research.md` — the exact Phius `-mon.txt` and PHI xlsx shapes; the
  field list the standardized record must cover.
- `../PRD.md` §4.3 — the `ClimateRecord` schema.
- `../decisions.md` D-CL-8 / D-CL-9 / D-CL-10.
- **Reuse investigation (do first, D-CL-10):** check `honeybee-ph` /
  `PHX` (already backend deps) for an existing PHPP monthly-climate
  reader/model. The Phius `-mon.txt` IS the PHPP climate import format.
  If a parser/model exists, normalize the standardized record to it
  rather than hand-rolling — and record what you found.

## 2. Work

### 2.1 Standardized record schema
- Pydantic v2 `ClimateRecord` per PRD §4.3 (identity + 12 monthly arrays
  + design block + aux), SI-canonical. Align field names with the
  honeybee-ph PH-climate model where one exists (D-CL-10) so it can
  round-trip to HBJSON/PHPP.
- Once settled, promote the schema to a `context/` reference doc (stable
  contract; planning/.instructions.md source-of-truth rule).

### 2.2 Reference-dataset storage (app-wide, versioned — D-CL-8)
- Migration: `climate_dataset` `(id, provider, version, label, source,
  created_at)` with `(provider, version)` unique; immutable once seeded.
- `climate_dataset_location` `(id, dataset_id FK, name, country, region,
  climate_zone, latitude, longitude, elevation_m, station_id, data
  JSONB)`. Indexes: `(dataset_id, country, region)` and a lat/long index
  for nearest-station lookup.
- App-scoped, not project-scoped — no `project_id`.

### 2.3 Seed importers
- **Phius (2022):** parse the 1007 `USA/<ST>/<STATION>-mon.txt` files
  (tab-delimited, cp1252; mind the German labels + degree-symbol
  mojibake) → `ClimateRecord` → rows under
  `provider='phius', version='2022'`. Assert the seeded count matches
  the file count.
- **PHI (PHPP 10.6):** read the `Climate` sheet of
  `phi_phpp_10_6_climate_data.xlsx` (~1474 rows; ignore PER-factor /
  interpolation columns) → `ClimateRecord` → rows under
  `provider='phi', version='10.6'`.
- Make the importer a re-runnable seed routine (idempotent per
  `(provider, version)`), not a one-off script — future versions reuse
  it. The interactive admin upload/update UI is **out of scope** (Ed);
  a CLI/seed entry point is enough now.
- **Seed-file availability:** the raw example files
  (`planning/features/climate/example_data/`) are **gitignored** (Ed,
  2026-06-13) — they are not in the repo. `../research.md` is the
  durable record of their shape. At implementation, Ed provides the
  canonical Phius/PHI source files; place them in a committed backend
  seed-data location the routine reads (NOT under `planning/`, NOT on
  the `research/` import path).

### 2.4 Read endpoints + MCP
- `GET /api/v1/climate/datasets` — list provider/version datasets.
- `GET /api/v1/climate/datasets/{id}/locations?country=&region=&near=lat,long`
  — search/list locations (paginated; nearest-N for `near`).
- `GET /api/v1/climate/datasets/{id}/locations/{loc_id}` — the
  standardized record.
- MCP tools mirroring these (`list_climate_datasets`,
  `search_climate_locations`, `get_climate_location`), `project:read`
  or app-read scope as appropriate. These are app-scoped reference
  reads, not project-scoped.

## 3. Tests

- **pytest:** Phius importer round-trips a known station file → exact
  monthly values (golden); PHI importer round-trips a known row; seed
  count assertions; `(provider, version)` uniqueness; nearest-location
  query; standardized-record validation.
- **`make ci`** green (new migration runs; seed routine covered).

## 4. Exit criteria

- Standardized `ClimateRecord` defined (+ promoted toward `context/`).
- Phius 2022 + PHI 10.6 seeded, queryable, version-tagged; counts
  verified.
- Reuse decision (D-CL-10) recorded (what honeybee-ph/PHX offered).
- Read endpoints + MCP live. `make ci` green.
