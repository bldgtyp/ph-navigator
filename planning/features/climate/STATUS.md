---
DATE: 2026-06-13
TIME: -
STATUS: Active — Phase 1 + Phase 2 implemented (2026-06-13). Phase 2
  ships the standardized `ClimateRecord`, the app-wide versioned dataset
  store, the Phius `-mon.txt` importer (now **revalidated against the real
  1007-station 2022 set** + a committed seed CLI), and dataset read
  endpoints + MCP. The PHI/PHPP xlsx importer is the one remaining slice
  (workbook now on disk; needs `openpyxl` + `io_climate.py` study). Phase 3
  (the tab) is unblocked; its setter-migration + tab-placement questions are
  resolved (see Decisions).
AUTHOR: Claude (for Ed)
SCOPE: Status, gates, and decisions for the Climate feature.
RELATED:
  - README.md
  - PRD.md
  - decisions.md
  - PLAN.md
---

# Climate — Status

## Current state

**Phase 1 + Phase 2 implemented; Phase 3 in progress (sub-phase 3a
shipped) — 2026-06-13.** `make ci` green (backend 800 passed; frontend
1586).

- **Phase 3a** — the Climate tab is live: `climate` tab added to
  `PROJECT_TABS` (right after Status); new `frontend/src/features/climate/`
  client (`types`/`api`/`query-keys`/`hooks`) over the
  `/api/v1/climate/datasets…` endpoints; a reference-dataset **browser**
  (dataset picker + country/region filter + nearest-to-project) with the
  standardized record rendered as read-only monthly + design-condition
  tables (IP/SI temperature toggle); a read-only project-location card.
  Tests: `features/climate/__tests__/` (lib, api query builder, record-table
  render + unit toggle). **Remaining 3a step:** migrate the rich location
  *editor* into the tab (D-CL-3) — today the tab shows location read-only
  and editing still happens in Settings.

- **Phase 1** — pure `build_sun_path(...)` + `GET …/sun-path` route +
  `get_project_sun_path` MCP tool in `backend/features/project_location/`.
  True-north sign verified by fixture as **identity** to ladybug's
  `north_angle` (D-PL-4). Committed `005839dc`.
- **Phase 2** — new `backend/features/climate/` module:
  - `record.py` — Pydantic v2 `ClimateRecord` mirroring
    `honeybee_ph.site` with `from_/to_honeybee_ph_site()` adapters,
    lossless round-trip verified (D-CL-10).
  - migration `20260613_0025` — app-wide `climate_dataset` +
    `climate_dataset_location` (versioned, JSONB record, geo + lat/long
    indexes).
  - `repository.py` / `service.py` — list/search/nearest/get + an
    idempotent `seed_dataset(...)` routine.
  - `importers/phius.py` — `-mon.txt` parser → `ClimateRecord` +
    `seed_phius_dataset(...)`, **revalidated against the real Phius 2022
    set (1007 stations, all 50 states parse + seed clean)**; the golden
    fixture is now a real, unmodified Worcester-MA station file.
  - `importers/__main__.py` — committed re-runnable seed CLI:
    `uv run python -m features.climate.importers --provider phius --root <dir>`.
  - `routes.py` — `GET /api/v1/climate/datasets`,
    `…/datasets/{id}/locations` (country/region + `near=lat,long`),
    `…/locations/{id}`.
  - `mcp.py` — `list_climate_datasets` / `search_climate_locations` /
    `get_climate_location` (app-wide; token-gated, no project scope).

**Phius revalidation — DONE (2026-06-13).** Ed's real Phius 2022 files
turned out to be on disk (gitignored under
`planning/features/climate/example_data/`). The blind-authored parser was
**rewritten against the verified real format** — packed label-scan header
rows, numeric-only design tails (Dewpoint/Sky design cells are metadata,
skipped), units/German stripping, albedo-from-sentence, country=US +
region from the file path. All 1007 files parse and seed clean (50 states;
honeybee round-trip stays lossless). The REVALIDATION NOTE is retired.

**Deferred within Phase 2:** the **PHI/PHPP xlsx seed importer** — the
PHPP workbook (`phi_phpp_10_6_climate_data.xlsx`) is now on disk too, but
reading it needs `openpyxl` (not yet a dep) + a study of the `Climate`
worksheet layout against `PHX/PHPP/sheet_io/io_climate.py`. The
storage/API/MCP layer is provider-agnostic; PHI plugs in via the same
`seed_dataset(...)` once a parser exists.

## Next step

Continue `phases/phase-03-climate-tab-ui.md`. **3a is shipped** (tab +
dataset browser + read-only location + record tables). Remaining 3a
step: **migrate the rich location editor into the tab** (D-CL-3 —
extract `EditableLocationFields`, leave a compact read-only summary in
Settings). Then **3b** (new backend `project_climate_source` model +
attach/select; D-CL-4/D-CL-11) and **3c** (charting-lib decision +
monthly graphs + the sun-path visual, coordinated with
`model-viewer-sun-path`). Independent follow-ups still open: (a) the PHI
xlsx importer (deferred; see phase-02 §5); (b) promote `ClimateRecord`
to a `context/` reference doc.

## Decisions

- **Implemented as recommended (Phase 1):** D-CL-1 (extends, not
  replaces `project_location`), D-CL-2 (sun-path service home + shared
  `GET /projects/{id}/sun-path` endpoint), D-PL-4 (true-north sign =
  identity, fixture-verified).
- **Implemented as recommended (Phase 2):** D-CL-10 (`ClimateRecord`
  PINNED to mirror `honeybee_ph.site`; adapters not subclassing —
  round-trip verified), **D-CL-8 (app-wide versioned reference
  datasets — `climate_dataset*` tables)**. The Phius `-mon.txt` parser
  landed and is **revalidated against the real 1007-station set**; the
  `io_climate.py` reuse for the PHI seed is the deferred slice.
- **Resolved (Ed 2026-06-13, for Phase 3):** **D-CL-3 setter
  migration** — migrate the rich location editor into the Climate tab,
  leaving a compact read-only summary in Settings. **Tab placement** —
  Climate sits near the front of `PROJECT_TABS`, right after Status.
- **Resolved (Ed 2026-06-13):** D-CL-4 (store all sources; ASHRAE
  pointer).
- **Implemented (Phase 3a):** D-CL-3 (the Climate tab exists, placed
  after Status; the editor-migration half of D-CL-3 is the remaining 3a
  step).
- **Proposed, recommended (confirm on review):** D-CL-6 (store the EPW),
  D-CL-7 (durable + editable location; reproducibility via pinning),
  **D-CL-9 (custom locations — schema supports it; tab wiring is 3b)**,
  **D-CL-11 (per-analysis source selection — 3b)**.
- **Deferred to later feature work (Ed 2026-06-13):** the design-
  conditions/use-case layer (Phase 4) and **D-CL-5** (fRSI interior
  assumption) and the temperature-asymmetry use-case. Focus is the data
  store first.
- **Settled:** ASHRAE stays a pointer for now (D-CL-4).

## Blockers

- None for Phase 3 (Phase 1 + Phase 2 endpoints exist; Phius dataset
  real + seeded).
- **PHI/PHPP seed** deferred (Ed 2026-06-13, behind the Phase-3 tab).
  Investigated: the xlsx is a live PHPP `Climate` worksheet with the
  library embedded as ~130 unlabeled formula columns × ~1000 datasets
  (`io_climate.py` only reads the active climate, not the library) — a
  full anchor-and-validate session, not a quick parser. See phase-02 §5
  Deferred for the recovery plan.
- Phase 4 is deferred (later feature work).

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Sun-path service | **Implemented** (2026-06-13; committed `005839dc`) | none |
| 2 — Reference datasets + standardized format | **Implemented** (2026-06-13; `make ci` green). Phius parser revalidated + real 1007-station seed verified + seed CLI. PHI xlsx importer still deferred (workbook on disk; needs `openpyxl` + `io_climate.py`) | none |
| 3 — Climate tab UI | **In progress** — 3a shipped (tab + dataset browser + read-only location + record tables; `make ci` green). Remaining: 3a editor migration, 3b source attach/select (new backend), 3c charts + sun-path | Phase 1 + Phase 2 (met) |
| 4 — Design conditions + metrics | **Deferred** (later feature work) | scheduled fRSI/comfort consumer (+ D-CL-5) |

## Dependent features (read Climate; built elsewhere)

| Feature | Needs | Where |
|---|---|---|
| Model Viewer sun-path render | Phase 1 endpoint | `planning/features_v1.1/model-viewer-sun-path/` |
| Thermal-Bridges fRSI | Phase 4 design conditions | future feature |
| Window thermal-comfort | Phase 4 design heating temp | future feature |
