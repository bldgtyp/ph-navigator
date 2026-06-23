---
DATE: 2026-06-13
TIME: -
STATUS: Complete (archived 2026-06-14) — Phases 1–3 implemented and on main.
  Phase 1 (sun-path service) + Phase 2 (standardized `ClimateRecord`,
  app-wide versioned dataset store, Phius `-mon.txt` importer revalidated
  against the real 1007-station 2022 set + seed CLI, dataset read endpoints +
  MCP) + Phase 3 (the Climate tab: location editor, sources roster,
  reference-dataset browser, monthly graphs, sun-path visual) are all done.
  Remaining deferred work moved to `planning/features_v1.1/climate-*`
  (PHI importer, design conditions, tab follow-ups).
AUTHOR: Claude (for Ed)
SCOPE: Status, gates, and decisions for the Climate feature.
RELATED:
  - README.md
  - PRD.md
  - decisions.md
  - PLAN.md
---

# Climate — Status

> **⚠️ Correction (2026-06-23): the "Phase 1 sun-path service" described
> below was REMOVED from `main` on 2026-06-22** (commit `0056f6df`, with the
> Climate-page sun-path panel) and is **not** the home of the sun path. The
> sun-path builder + `GET /projects/{id}/sun-path` endpoint were rebuilt in
> **`project_location`** (their actual data owner) and the diagram is a
> **Model-tab** feature. Climate is app-wide reference data only and does not
> own the sun path. For the live story see
> `planning/archive/model-viewer-sun-path/STATUS.md`. The text below is
> a frozen 2026-06-14 archive — do not trust its sun-path claims.

## Current state

**Phase 1 + Phase 2 + Phase 3 implemented (3a + 3b + 3c all COMPLETE) —
2026-06-14.** `make ci` green (backend + frontend suites passing). Phase 3
(the Climate tab) is done end-to-end: location editor, sources roster,
reference-dataset browser, monthly graphs, and the sun-path visual.

- **Phase 3a — COMPLETE (2026-06-13).** The Climate tab is live: `climate`
  tab added to `PROJECT_TABS` (right after Status); new
  `frontend/src/features/climate/` client (`types`/`api`/`query-keys`/
  `hooks`) over the `/api/v1/climate/datasets…` endpoints; a
  reference-dataset **browser** (dataset picker + country/region filter +
  nearest-to-project) with the standardized record rendered as read-only
  monthly + design-condition tables (IP/SI temperature toggle). **The rich
  location editor now lives in the Climate tab** (D-CL-3): the editor + EPW
  upload/parse flow were extracted into a reusable `useProjectLocationForm`
  hook + `ProjectLocationEditor`/`ProjectLocationSummary` components; the tab
  hosts the editable section with its own Save, and project **Settings now
  shows a compact read-only summary** that points to the Climate tab. Tests:
  `features/climate/__tests__/` (lib, api query builder, record-table render +
  unit toggle, `ClimateLocationSection` editor/viewer/EPW/late-resolve) +
  the slimmed `ProjectSettingsModal.location` read-only test.

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
`planning/archive/climate/example_data/`). The blind-authored parser was
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

**None — the feature is complete and archived.** Phase 3 (3a + 3b + 3c,
2026-06-14) shipped the tab: the location editor (Settings read-only), the
**climate-sources roster** (attach Phius/PHI from the browser, ASHRAE
pointer, project EPW; one default — D-CL-4/9/11), the reference-dataset
browser, **monthly graphs** (recharts, behind a Table/Charts toggle), and the
**2D SVG sun-path visual**. The "see + record + compare sources" data-store
goal (Phases 1–3) is met.

Remaining deferred work was split into three v1.1 candidates (2026-06-14):

- `planning/features_v1.1/climate-phi-importer/` — the PHI/PHPP xlsx importer
  (was phase-02b).
- `planning/features_v1.1/climate-design-conditions/` — per-source design
  conditions (was Phase 4).
- `planning/features_v1.1/climate-tab-followups/` — custom-record entry form,
  sun-path cardinal labels, attached-source charts, and promoting
  `ClimateRecord` to a `context/` doc.

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
- **Implemented (Phase 3a) — D-CL-3 fully done:** the Climate tab exists,
  placed after Status, and **owns the location editor**; project Settings
  keeps only a compact read-only summary that points to the tab.
- **Proposed, recommended (confirm on review):** D-CL-6 (store the EPW),
  D-CL-7 (durable + editable location; reproducibility via pinning).
- **Implemented (Phase 3b, 2026-06-14 — backend + frontend):** **D-CL-4**
  (store all sources — `project_climate_source`, one row per attached
  source; roster UI), **D-CL-9** (custom record stored as the `custom`
  kind's `data` — backend ready; the entry *form* is a deferred follow-up),
  **D-CL-11** (one project default, partial-unique enforced + `PUT …/default`
  + the roster default radio).
- **Implemented (Phase 3c, 2026-06-14):** charting library = **recharts**
  (Ed-confirmed; over visx / hand-rolled SVG) for the monthly graphs;
  sun-path visual = **2D SVG** (Ed-confirmed; over reusing the 3D three.js
  layer) projected from the Phase-1 DTO. `ClimateTab` lazy-loaded to keep
  recharts out of the initial bundle.
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
| 3 — Climate tab UI | **Complete** (2026-06-14) — 3a + 3b + 3c all done (tab + dataset browser + record tables + location editor + sources roster + monthly graphs + sun-path visual; `make ci` green) | Phase 1 + Phase 2 (met) |
| 2b — PHI/PHPP importer (`phase-02b-…`) | **Deferred** — ~130-col PPP-worksheet reverse-engineering + `openpyxl`; seed seam ready | independent |
| 3b — Source attach/select (`phase-03b-…`) | **Complete** 2026-06-14 — backend (`project_climate_source` + routes + MCP) + frontend (sources roster + default radio + Phius/PHI/ASHRAE/EPW attach); `make ci` green. Custom-record entry form deferred | 3a complete (met) |
| 3c — Visualization (`phase-03c-…`) | **Complete** 2026-06-14 — recharts monthly graphs (Table/Charts toggle) + 2D SVG sun-path visual; ClimateTab lazy-loaded; `make ci` green | after 3b (met) |
| 4 — Design conditions + metrics | **Deferred** (later feature work) | scheduled fRSI/comfort consumer (+ D-CL-5) |

See `PLAN.md` → "Deferred work index" for the suggested order across these
later phases.

## Dependent features (read Climate; built elsewhere)

| Feature | Needs | Where |
|---|---|---|
| Model Viewer sun-path render | Phase 1 endpoint | `planning/archive/model-viewer-sun-path/` |
| Thermal-Bridges fRSI | Phase 4 design conditions | future feature |
| Window thermal-comfort | Phase 4 design heating temp | future feature |
