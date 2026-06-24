---
DATE: 2026-06-13
TIME: -
STATUS: Implemented 2026-06-13 — standardized `ClimateRecord` + adapters,
  app-wide dataset store + migration, Phius importer + seed routine, read
  endpoints + MCP all landed; `make ci` green. The Phius importer is now
  **revalidated against the real 1007-station 2022 set** (parser rewritten
  to the verified format, real seed verified, seed CLI added). The
  PHI/PHPP xlsx importer is the one remaining deferred slice (workbook on
  disk; needs `openpyxl` + `io_climate.py` study). See §5 Outcome.
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
  (`planning/archive/climate/example_data/`) are **gitignored** (Ed,
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

## 5. Outcome (implemented 2026-06-13)

Landed as a new `backend/features/climate/` module (app-wide reference
data is its own concern, kept separate from project-scoped
`project_location`; the eventual `project_location → climate` rename is a
Phase-3 follow-up).

- **`record.py`** — Pydantic v2 `ClimateRecord` (+ `ClimateLocation` /
  `ClimateData` / `ClimateMonthlyTemps` / `ClimateMonthlyRadiation` /
  `ClimatePeakLoad(s)` / `ClimateGround` / `ClimatePhppCodes` /
  `ClimateAux`) mirroring `honeybee_ph.site` (PRD §4.3, D-CL-10).
  `from_honeybee_ph_site()` / `to_honeybee_ph_site()` adapters bridge our
  ordered 12-element monthly lists ↔ honeybee_ph's month-keyed dicts;
  identity/`aux` ride along in `user_data`. **Lossless round-trip is
  test-pinned** (`Site().to_dict()` → record → `Site.from_dict()` equal).
  Used `glob` (not `global`) for global-horizontal radiation to keep the
  bridge a trivial pass-through and stay a valid Python identifier.
- **migration `20260613_0025`** — `climate_dataset` (`(provider,
  version)` unique) + `climate_dataset_location` (`data` JSONB, geo +
  lat/long indexes), app-wide (no `project_id`), immutable per release.
- **`repository.py` / `service.py`** — list/search (country/region),
  nearest (planar + cos-lat correction, no PostGIS), get; plus an
  idempotent `seed_dataset(provider, version, records, …)` (delete +
  rebuild per `(provider, version)` in one transaction; `replace=False`
  to no-op on an existing release).
- **`importers/phius.py`** — `parse_phius_mon_txt/file` → `ClimateRecord`
  (label→field mapping centralized in `_SERIES_FIELDS` / `_SCALARS`; the
  3 design columns → heat1/heat2/cooling1) + `seed_phius_dataset(root)`.
  **Revalidated against the real Phius 2022 set** (1007 files, all 50
  states parse + seed clean): the parser was rewritten for the verified
  real shape — packed label-scan header rows, numeric-only design tails
  (Dewpoint/Sky design cells are metadata, skipped), units/German label
  stripping, albedo-from-sentence, country=US + region from the file path,
  first-block-wins on the one duplicated file (`DALLAS_LOVE_FIELD`). The
  golden fixture is now a real, unmodified station file
  (`tests/fixtures/climate/phius/USA/MA/WORCHESTER_REGIONAL_ARPT_MA-mon.txt`).
- **`importers/__main__.py`** — committed re-runnable seed CLI:
  `uv run python -m features.climate.importers --provider phius --root <dir>`
  (idempotent per `(provider, version)`; `--no-replace` to skip an
  existing release).
- **`routes.py`** — `GET /api/v1/climate/datasets`,
  `…/datasets/{id}/locations?country=&region=&near=lat,long`,
  `…/datasets/{id}/locations/{loc_id}` (auth = any signed-in user).
- **`mcp.py`** — `list_climate_datasets` / `search_climate_locations` /
  `get_climate_location`, app-wide (token-gated, **no** project scope —
  the datasets are shared); route/MCP parity test-pinned.

Tests: `tests/test_climate_datasets.py` (honeybee round-trip + identity,
Phius parser golden + truncation guard, seed idempotency + replace=False,
route list/search/nearest/detail + 404 + bad-`near`, MCP parity + auth).
`make ci` green (backend 800 passed).

### Real Phius seed — DONE (2026-06-13)

Ed's real Phius 2022 files were on disk (gitignored under
`planning/archive/climate/example_data/`). The parser was rewritten
against the verified real format, all 1007 stations parse + seed clean
(50 states; ~1.3 s), and the seed was verified against the dev DB
(`location_count == 1007`). The honeybee_ph round-trip stays lossless.
Seed inserts are per-row in one transaction — fine at this volume (1.3 s);
batch with `executemany` only if a future, larger set is slow. The
REVALIDATION NOTE is retired.

### Deferred — promoted to their own phase docs

The Phase-2 deferrals are now tracked as first-class later-work phases
(Ed 2026-06-13, "record deferred items as new phases"):

- **PHI/PHPP xlsx seed importer → `phase-02b-phi-phpp-importer.md`.**
  Investigated: the workbook is a live PHPP `Climate` worksheet with the
  library embedded as ~130 unlabeled formula columns × ~1000 datasets
  (`io_climate.py` only reads the active climate) — a full
  anchor-and-validate session, not a quick parser. The storage/API/MCP
  layer is provider-agnostic (`seed_dataset(...)`) and the CLI has a
  `--provider` seam, so only the parser is missing. Full recovery plan in
  that doc.
- **Promote `ClimateRecord` to `context/`** — small follow-up; tracked in
  `PLAN.md` → "Deferred work index" (the authoritative contract currently
  lives in `features/climate/record.py` docstrings + PRD §4.3).
