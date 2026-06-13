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

- `../research.md` — the Phius `-mon.txt` / PHI xlsx shapes **and the
  completed PH-Tools reuse investigation** (the three existing models +
  the `io_climate.py` reader). Read this first.
- `../PRD.md` §4.3 — the `ClimateRecord` schema, **pinned to
  `honeybee_ph.site`**.
- `../decisions.md` D-CL-8 / D-CL-9 / D-CL-10 (D-CL-10 resolved).
- The actual PH-Tools source (Ed's libs, backend deps):
  - `honeybee_ph/honeybee_ph/site.py` — `Site`/`Location`/`Climate`/
    `Climate_MonthlyTempCollection`/`Climate_MonthlyRadiationCollection`/
    `Climate_PeakLoadCollection`/`Climate_PeakLoadValueSet`/`PHPPCodes`.
    **The alignment target.**
  - `PHX/PHX/PHPP/sheet_io/io_climate.py` — PHPP Climate-worksheet
    reader (reference/reuse for the PHI xlsx seed).
  - `PHX/PHX/model/phx_site.py` — the export model (4 design conditions).

## 2. Work

### 2.1 Standardized record schema (PINNED — D-CL-10)
- Pydantic v2 `ClimateRecord` **mirroring `honeybee_ph.site.Site`**
  (PRD §4.3): `location` (Location), `climate` (Climate: station
  elevation, summer swing, wind, ground, `monthly_temps`,
  `monthly_radiation`, `peak_loads` ×4), `phpp_codes` (PHPPCodes), plus
  our `provider`/`version`/`station_id` identity and an `aux` block.
  SI verbatim from honeybee_ph (radiation kWh/m² monthly, W/m² peak;
  temps °C; elevation m; wind m/s; swing K).
- Provide `from_honeybee_ph_site()` / `to_honeybee_ph_site()` adapters
  over the existing `Site.from_dict()`/`to_dict()`. **Do not subclass**
  the py2.7 honeybee_ph classes — mirror the dict shape and adapt.
- Promote the schema to a `context/` reference doc once it lands (stable
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
  `provider='phius', version='2022'`. No existing reader — thin custom
  parser, but the fields map 1:1 onto `honeybee_ph.Climate` (research.md).
  Assert the seeded count matches the file count.
- **PHI (PHPP 10.6):** read the `Climate` sheet of the PHPP xlsx
  (~1474 rows; ignore PER-factor / interpolation columns) → `ClimateRecord`
  → rows under `provider='phi', version='10.6'`. **Reuse/reference
  `PHX/PHX/PHPP/sheet_io/io_climate.py`** — it already reads this exact
  worksheet (country/region/dataset, lat/long, elevation, monthly data).
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

- `ClimateRecord` defined mirroring `honeybee_ph.site` + adapters
  (round-trips to `Site.to_dict()`); promoted toward `context/`.
- Phius 2022 + PHI 10.6 seeded, queryable, version-tagged; counts
  verified (Phius ~1007).
- Read endpoints + MCP live. `make ci` green.
