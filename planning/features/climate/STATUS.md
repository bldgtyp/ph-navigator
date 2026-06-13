---
DATE: 2026-06-13
TIME: -
STATUS: Active — Phase 1 + Phase 2 implemented (2026-06-13). Phase 2
  ships the standardized `ClimateRecord`, the app-wide versioned dataset
  store, the Phius `-mon.txt` importer + seed routine, and dataset read
  endpoints + MCP. PHI/PHPP xlsx seed importer is the one deferred slice
  (awaits Ed's real workbook). Phase 3 (the tab) is now unblocked.
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

**Phase 1 (sun-path service) + Phase 2 (reference datasets) implemented
2026-06-13.** `make ci` green (backend 800 passed; frontend 1575).

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
    `seed_phius_dataset(...)`, tested against a golden fixture.
  - `routes.py` — `GET /api/v1/climate/datasets`,
    `…/datasets/{id}/locations` (country/region + `near=lat,long`),
    `…/locations/{id}`.
  - `mcp.py` — `list_climate_datasets` / `search_climate_locations` /
    `get_climate_location` (app-wide; token-gated, no project scope).

**Deferred within Phase 2:** the **PHI/PHPP xlsx seed importer** — the
exact worksheet cell layout cannot be reconstructed blind, so it awaits
Ed's real PPP workbook + a reference to `PHX/PHPP/sheet_io/io_climate.py`.
The storage/API/MCP layer is provider-agnostic; PHI plugs in via the same
`seed_dataset(...)` once a parser exists. The Phius importer was authored
against the documented `research.md` shape + a golden fixture and carries
a **REVALIDATION NOTE** (reconcile labels/encoding against the real files
before the production seed).

## Next step

Implement `phases/phase-03-climate-tab-ui.md` (the Climate tab) — now
unblocked: Phase 1 + Phase 2 endpoints both exist. Two small Phase-2
follow-ups to fold in: (a) run the real Phius seed + write the PHI xlsx
importer once Ed provides the files; (b) promote the `ClimateRecord`
schema to a `context/` reference doc (the authoritative contract
currently lives in `features/climate/record.py` docstrings).

## Decisions

- **Implemented as recommended (Phase 1):** D-CL-1 (extends, not
  replaces `project_location`), D-CL-2 (sun-path service home + shared
  `GET /projects/{id}/sun-path` endpoint), D-PL-4 (true-north sign =
  identity, fixture-verified).
- **Implemented as recommended (Phase 2):** D-CL-10 (`ClimateRecord`
  PINNED to mirror `honeybee_ph.site`; adapters not subclassing —
  round-trip verified), **D-CL-8 (app-wide versioned reference
  datasets — `climate_dataset*` tables)**. The Phius `-mon.txt` thin
  parser landed; the `io_climate.py` reuse for the PHI seed is the
  deferred slice.
- **Resolved (Ed 2026-06-13):** D-CL-4 (store all sources; ASHRAE
  pointer).
- **Proposed, recommended (confirm on review):** D-CL-3
  (new 6th tab, gated to Phase 3), D-CL-6 (store the EPW), D-CL-7
  (durable + editable location; reproducibility via pinning),
  **D-CL-9 (custom locations — schema supports it via the standardized
  record; tab wiring is Phase 3)**, **D-CL-11 (per-analysis source
  selection — Phase 3)**.
- **Deferred to later feature work (Ed 2026-06-13):** the design-
  conditions/use-case layer (Phase 4) and **D-CL-5** (fRSI interior
  assumption) and the temperature-asymmetry use-case. Focus is the data
  store first.
- **Settled:** ASHRAE stays a pointer for now (D-CL-4).

## Blockers

- None for Phase 3 (Phase 1 + Phase 2 endpoints exist).
- **Real-data seed** needs Ed's files: the Phius `-mon.txt` set (run the
  seed + revalidate the parser) and the PHI/PHPP xlsx (write the importer).
  Code path + tests are in place against fixtures; only the bulk seed waits.
- Phase 4 is deferred (later feature work).

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 1 — Sun-path service | **Implemented** (2026-06-13; committed `005839dc`) | none |
| 2 — Reference datasets + standardized format | **Implemented** (2026-06-13; `make ci` green). PHI xlsx importer + real-data seed deferred (await Ed's files) | none |
| 3 — Climate tab UI | Planned — ready (**focus**) | Phase 1 + Phase 2 (met) |
| 4 — Design conditions + metrics | **Deferred** (later feature work) | scheduled fRSI/comfort consumer (+ D-CL-5) |

## Dependent features (read Climate; built elsewhere)

| Feature | Needs | Where |
|---|---|---|
| Model Viewer sun-path render | Phase 1 endpoint | `planning/features_v1.1/model-viewer-sun-path/` |
| Thermal-Bridges fRSI | Phase 4 design conditions | future feature |
| Window thermal-comfort | Phase 4 design heating temp | future feature |
