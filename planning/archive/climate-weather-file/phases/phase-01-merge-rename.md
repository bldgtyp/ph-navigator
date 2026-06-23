---
DATE: 2026-06-22
TIME: 20:35 EDT
STATUS: ✅ Shipped (2026-06-22) — backend + frontend tests green. Cooling
  offsets pinned by the synthetic `.stat` fixture; migration `0034` swaps the
  kind set + CHECK constraint.
AUTHOR: Claude (for Ed)
SCOPE: P1 — collapse ASHRAE + EPW into one `weather` source, rename the kind,
  extend the design-condition data set, render one Weather File page with the
  full metric set. Vertical slice; app + CI green.
RELATED:
  - ../PRD.md §3 (D1/D2/D3), §4 (data delta), §5 (backend), §6 (frontend)
  - backend/features/climate/{design_conditions,stat_parser,ashrae_meteo}.py
  - backend/features/project_climate_source/{models,service,routes}.py
  - backend/features/project_location/service.py
  - frontend/src/features/climate/{types,lib}.ts,
    components/ClimateSourceDetailPage.tsx, components/ClimateSourceSidebar.tsx
---

# Phase 1 — Unify to one "Weather File" item (merge + rename + full data set)

## Goal

Replace the separate **ASHRAE** and **EPW** sidebar items with a single
**Weather File** source (`kind="weather"`) that carries the full STAT-derived
metric + design-condition set and renders on one page. Delivers asks **#1**
(merge) and **#3** (full metrics). The picker (#2) and the upload modal come in
P2/P3 — this phase keeps the existing "Set from nearest" button and the
temporary inline upload (relabeled) so the app stays green.

## Why this is one vertical slice

Renaming the source kind backend-only would break the frontend (which filters
`kind === "epw"` / `"ashrae"` and types `ClimateSourceKind`). So the rename +
merge land together, backend and frontend, in one phase.

## Scope

### A. Design-condition data set (backend)

- `design_conditions.py` — add to `ClimateDesignConditions` (all `float | None`):
  `cooling_004_db_c`, `cooling_004_mcwb_c`, `cooling_020_db_c`,
  `cooling_020_mcwb_c`. Keep the existing heating/1%-cooling/dehum/record fields.
- `stat_parser.py` — extract the new columns from the `cooling` row. Current map:
  `cooling_010_db_c = cooling[4]`, `cooling_010_mcwb_c = cooling[5]` (1%). Expected:
  - `cooling_004_db_c = cooling[2]`, `cooling_004_mcwb_c = cooling[3]` (0.4%)
  - `cooling_020_db_c = cooling[6]`, `cooling_020_mcwb_c = cooling[7]` (2%)
  **VERIFY these offsets against a real OneBuilding TMYx `.stat` Cooling row**
  before trusting them (see Risks). Add to `design_values`, the
  `ClimateDesignConditions(...)` call, and `missing_fields`.
- Test fixture — the synthetic `.stat` used by `tests/test_climate_design_conditions.py`
  must include a Cooling row that covers 0.4/1/2% so the offsets are pinned by a
  test (no licensed data — synthetic only, public-repo rule).
- `ashrae_meteo.py` — add 0.4%/2% keys to `design_conditions_from_ashrae_station`
  so a current-edition refresh fills the same shape. *Secondary; `.stat` is the
  default path — can land with `missing_fields` if the response keys are
  unconfirmed.*

### B. Rename `epw` → `weather` source kind (backend)

- `project_climate_source/models.py`:
  - `ClimateSourceKind = Literal["phius","phi","weather","custom"]` (drop `epw`,
    `ashrae`).
  - `_REF_KINDS = {"phius","phi","weather"}`; `_DATA_KINDS =
    {"custom","weather","phius","phi"}`.
  - `validate_source_shape` — the `epw` ref branch becomes `weather`.
  - Update the module + `ProjectClimateSourcePublic` docstrings (EPW → weather
    bundle; `ref` = primary EPW asset id, `.stat`/`.ddy` ids in `data`).
- `project_climate_source/service.py`:
  - `_validate_source` `elif kind == "epw"` → `"weather"`.
  - Rename `_validate_epw_ref` → `_validate_weather_ref` (still asserts the ref
    asset exists and `asset_kind == "epw"` — the primary file is an EPW).
  - `refresh_ashrae_design_conditions` — **upsert onto the `weather` source's
    `data.design_conditions`** (set `source="ashrae-meteo"`, `edition`), 409 if no
    weather source exists ("Set the weather file first"). Remove the `ashrae`
    source insert/update.
- `project_location/service.py`:
  - `build_weather_source_payloads` — emit a **single** `kind="weather"` source;
    **delete the `sources.append({"kind":"ashrae", …})` block**. The weather
    source's `data` already holds `stat_metrics` + `design_conditions`.
  - `existing_weather_source_values` — `source["kind"] == "epw"` → `"weather"`.
  - Grep for any other `"epw"`/`"ashrae"` kind literals in this file.
- MCP — `project_climate_source/mcp.py`, `climate/mcp.py`: update any `epw`/
  `ashrae` kind references / enum docs.
- **Alembic data migration** (data-only): `UPDATE project_climate_source SET
  kind='weather' WHERE kind='epw'; DELETE FROM project_climate_source WHERE
  kind='ashrae';`. Dev DB is reseedable, so this is belt-and-suspenders, but it
  keeps existing dev rows valid against the new `Literal`.

### C. Frontend rename + page merge

- `types.ts` — `ClimateSourceKind`: `epw`→`weather`, drop `ashrae`.
  `ClimateSourceDeriveKind` already `"weather"` (now matches the source kind).
- `lib.ts` — `CANONICAL_CLIMATE_KINDS = ["phius","phi","weather"]`; label map
  `weather: "Weather File"` (and badge short-label, e.g. "EPW+STAT" or "WX");
  update `climateSourceKindLabel` and any `kind === "epw" | "ashrae"` branches
  (`climateSourceSubtitle`, `climateSourceNavAttrs`, etc.).
- CSS tokens — `data-kind="epw"` / `data-kind="ashrae"` badge colors → a single
  `data-kind="weather"` token (`climate.css` / `ClimateAtoms`).
- `ClimateSourceDetailPage.tsx`:
  - Rename `EpwSourcePage` → `WeatherSourcePage`; **fold in** `AshraeSourcePage`'s
    design tiles and delete `AshraeSourcePage` + the `source.kind === "ashrae"`
    branch.
  - Expand the design-conditions tile grid: **Heating DB 99.6% / 99%**;
    **Cooling DB 0.4% / 1% / 2%**; **Cooling MCWB 0.4% / 1% / 2%**; keep the
    dehum tiles. Performance tiles (HDD65/CDD50/record low/high) unchanged.
  - Surface the **location name** in the header (`source.data.station.name` /
    `source.label`).
  - Route every temperature through `formatTemperatureFromC` (app SI/IP, D-CL-21).
  - `MISSING_SOURCE_COPY` — replace the `epw`/`ashrae` entries with a `weather`
    entry; drop the "ASHRAE design conditions are set together with the EPW"
    note in `MissingSourcePage`.
  - Keep `ProjectEpwControls` for now but neutralize the "Temporary home … while
    the EPW page is refactored" copy (it is removed in P3).
- `ClimateSourceSidebar.tsx` / `ClimateTab.tsx` — no structural change beyond the
  kind list; confirm one Weather File card renders and routes.
- Tests — `ClimateTab.test.tsx`, `ClimateRecordTable.test.tsx`, lib tests, and
  fixtures (`testing/recordFixture.ts`) referencing `kind: "epw" | "ashrae"` →
  `"weather"`; add assertions for the new cooling tiles + the location name.

## Tests

- **backend**: `test_climate_design_conditions.py` — new percentile fields parsed
  from the synthetic `.stat`; `missing_fields` correct when absent.
  `test_project_climate_source.py` — `weather` kind validates; `ashrae`/`epw`
  rejected; refresh updates the weather source in place.
  `test_project_location.py` — weather derive emits exactly one `weather` source
  carrying `stat_metrics` + `design_conditions`, no `ashrae`.
- **frontend**: vitest — sidebar shows one Weather File card; the page shows the
  full tile set + location name; `tsc --noEmit` clean.
- `make ci` green; Playwright visual (editor + viewer): one Weather File card,
  full tiles, SI/IP toggle flips temps.

## Exit criteria

One Weather File sidebar item/page; no separate ASHRAE item; the page shows
location name + HDD65/CDD50/record low-high + Heating 99.6/99 + Cooling DB
0.4/1/2 + Cooling MCWB 0.4/1/2 (app SI/IP); weather derive → a single `weather`
source; the duplicate `ashrae` source is gone; current-edition refresh updates
the weather source in place; CI green.

## Risks / checks

- **STAT cooling column offsets** — highest-confidence-needed item. Verify
  `cooling[2..7]` against a real TMYx `.stat`; pin with the synthetic fixture.
  Additive + low blast radius if wrong (a tile shows "—").
- **Badge token** — pick one color token for the merged `weather` kind; don't
  leave dangling `epw`/`ashrae` token rules.
- **MCP / other readers** — grep the whole backend + frontend for `"epw"` /
  `"ashrae"` kind string literals so none are missed (asset-kind `"epw"` strings
  must NOT be renamed — those are file types).
- **`project_location.epw_asset_id`** stays as-is this phase (still written by
  derive); its consolidation is a P3 concern.
