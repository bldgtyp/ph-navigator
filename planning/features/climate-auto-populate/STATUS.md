---
DATE: 2026-06-21
TIME: 13:52 EDT
STATUS: Active — P4 implemented; final gates running.
  Design decisions accepted (D-CL-12..24, O-units). Open items are operational only.
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate auto-populate feature.
RELATED:
  - README.md, PRD.md, decisions.md, research.md
  - phases/phase-01..04
---

# Climate Auto-Populate — Status

## Current state

`Active — P4 implemented; final gates running`. PRD, decisions, research, and
four phase plans logged.
Phase 1 implementation now extends `project_location` with derived public
geodata, editor-only geocode/derive endpoints, a committed PNNL 2021 IECC
county-zone CSV, and a Climate-tab editor action that populates
county/state/elevation/climate-zone from coordinates. Phase 2 adds
Phius/PHI nearest-source auto-attach on derive, haversine distance and
elevation-delta source metadata, the Phius 50 mi / 400 ft hard gate, and the
PHI representativeness advisory. Builds on the shipped climate store (archived
Phases 1–3): app-wide Phius/PHI datasets, `project_climate_source`, sun-path,
and the dataset browser all exist and are reused. Phase 3 adds nearest
OneBuilding EPW catalog lookup/download, server-side EPW asset creation, `.stat`
metrics/design-condition parsing, auto-attached `epw` and `ashrae` source data,
and an on-demand single-station `ashrae-meteo` current-edition refresh route.
Phase 4 replaces the Climate tab with a master-detail sidebar, per-source
detail pages, attached-source PH charts/tables, ASHRAE/EPW metric pages,
custom-record override entry, fail-page CTA/candidate rendering, app-wide
SI/IP radiation conversion, and N/E/S/W sun-path labels on the Location page.

## Next step

Planning is complete — all design decisions accepted (D-CL-12..24, O-units).
**Current implementation loop: finish P4 gates, then close the packet.**
Before production reliance, confirm **O5** (seeded Phius/PHI dataset versions
are a valid current cert basis). Procure **O4** keys (MapTiler / Open-Meteo)
before relying on free tiers.

Remaining open items are operational only: O4 (API keys), O5 (dataset
versions), O6 ("custom set required" workflow + custom-record editor), O7
(EPW catalog refresh cadence/storage beyond the in-process cached XLSX fetch).

## Blockers

- **O1–O3** (design decisions) — not hard blockers; recommendations stand if
  Ed defers.
- **O5** — confirm the seeded Phius/PHI dataset versions are a valid current
  cert basis before P2 ships proximity flags against them.
- **O4** — commercial API keys (MapTiler / Open-Meteo) needed before relying
  on free tiers in production.

## Files expected to change (high level — detail per phase)

- **Backend** — new `backend/features/climate/derive/` (or extend
  `project_climate_source/service.py`): external API clients (MapTiler proxy
  optional, EPQS, FCC/Census), the PNNL CSV + county→zone lookup, the EPW
  catalog + `.stat` parser, the ashrae-meteo client, the haversine proximity
  gate. New migration only if we add columns beyond `data` JSONB (not expected).
- **Frontend** — `frontend/src/features/climate/`: address modal +
  MapTiler component, the derive action, the roster visualization refactor
  (re-point `ClimateRecordView` at attached sources), public location
  projection. `frontend/src/features/projects/` location editor/summary
  adjustments for the privacy split.
- **Repo data** — `climate_zones.csv` (PNNL 2021 IECC, public domain).

## Verification plan

Per-phase `make ci` green + Playwright MCP visual pass on the Climate tab
(editor + viewer), plus focused pytest for each derive routine and the
proximity-gate math. Privacy check: the public projection / viewer DOM never
contains the address string.

## P1 verification (2026-06-21)

- `cd backend && uv run pytest tests/test_project_location.py` — 15 passed.
- `cd backend && uv run ruff check features/project_location tests/test_project_location.py config.py alembic/versions/20260621_0032_project_location_derived_geodata.py` — passed.
- `cd backend && uv run ty check features/project_location tests/test_project_location.py config.py` — passed.
- `cd frontend && pnpm exec vitest run src/features/projects/__tests__/location-form.test.ts src/features/projects/components/__tests__/ProjectSettingsModal.location.test.tsx src/features/climate/__tests__/ClimateSourcesSection.test.tsx` — 11 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- `make format` — passed.
- `make ci` — passed: backend `918 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` — passed
  for editor derive and mobile viewer privacy projection. Smoke project:
  `f82cd588-d1c5-4579-80c0-47cf7d02888e`; screenshots:
  `/tmp/phn-climate-p1-editor.png`, `/tmp/phn-climate-p1-viewer.png`.

## P2 verification (2026-06-21)

- `cd backend && uv run ty check features/climate/proximity.py features/project_location/service.py features/project_climate_source/models.py tests/test_climate_proximity.py tests/test_project_location.py` — passed.
- `cd backend && uv run pytest tests/test_climate_proximity.py tests/test_project_location.py tests/test_project_climate_source.py` — 33 passed.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/lib.test.ts` — 11 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` — passed
  for same-session Phius auto-attach and proximity roster rendering. Dev DB
  only had Phius seeded; PHI auto-attach is covered by focused pytest with a
  synthetic `phi` dataset. Smoke project:
  `2877cd2c-06fb-495d-8d62-db87117f277b`; screenshot:
  `/tmp/phn-climate-p2-phius-source.png`.
- `make format` — passed.
- `make ci` — passed: backend `927 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.

## P3 verification (2026-06-21)

- `cd backend && uv run ty check features/climate/design_conditions.py features/climate/stat_parser.py features/climate/epw_catalog.py features/climate/ashrae_meteo.py features/assets/service.py features/project_location/service.py features/project_location/routes.py features/project_climate_source/models.py features/project_climate_source/service.py features/project_climate_source/routes.py tests/test_climate_design_conditions.py tests/test_project_location.py tests/test_project_climate_source.py` — passed.
- `cd backend && uv run pytest tests/test_climate_design_conditions.py tests/test_project_location.py tests/test_project_climate_source.py tests/test_climate_proximity.py` — 41 passed.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/lib.test.ts` — 11 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` —
  passed. Smoke project `6040674c-c700-4e4b-b79a-40732b670eba`; derive linked
  `USA_MA_Pittsfield.Muni.AP.744104_TMYx.epw`, attached `epw`, `ashrae`, and
  `phius` rows, and rendered Pittsfield/HDD65/ASHRAE/EPW in the Climate tab.
  Dev DB still lacks a PHI seed, so the smoke emitted the expected PHI warning;
  PHI remains covered by P2 synthetic pytest. Screenshot:
  `/tmp/phn-climate-p3-roster.png`.
- `make format` — passed.
- `make ci` — passed: backend `935 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.

## P4 verification (2026-06-21)

- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateRecordTable.test.tsx src/features/climate/__tests__/chart-data.test.ts src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/ClimateTab.test.tsx src/features/climate/__tests__/sun-path.test.tsx` — 19 passed.
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` —
  passed. Smoke project `3a7d86b5-60b5-4186-998b-d0388f19852f`; derive
  attached `phius`, `ashrae`, and `epw` rows; Location rendered the sun-path,
  EPW rendered HDD/CDD + source/download links, and mobile ASHRAE rendered
  design-condition tiles without header overlap. Dev DB still lacks a PHI
  seed, so the smoke emitted the expected PHI warning. Screenshots:
  `/tmp/phn-climate-p4-location.png`, `/tmp/phn-climate-p4-epw.png`,
  `/tmp/phn-climate-p4-mobile-ashrae-fixed.png`.
- `make format` — passed.
- `make ci` — passed: backend `935 passed, 2 skipped`; frontend `187` test
  files / `1787` tests passed; Vite build passed. Existing warnings only:
  backend HTTP 413 deprecation, frontend fast-refresh/act warnings, and Vite
  chunk-size warnings.
