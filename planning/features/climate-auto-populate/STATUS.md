---
DATE: 2026-06-21
TIME: 13:52 EDT
STATUS: Active — P4 UI built to full wireframe-B2 fidelity; final gates running.
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
Phases 1–3): app-wide Phius/PHI datasets, `project_climate_source`, and the
dataset browser all exist and are reused. Phase 3 adds nearest
OneBuilding EPW catalog lookup/download, server-side EPW asset creation, `.stat`
metrics/design-condition parsing, auto-attached `epw` and `ashrae` source data,
and an on-demand single-station `ashrae-meteo` current-edition refresh route.
Phase 4 replaces the Climate tab with a master-detail sidebar, per-source
detail pages, attached-source PH charts/tables, ASHRAE/EPW metric pages,
custom-record override entry, fail-page CTA/candidate rendering, app-wide
SI/IP radiation conversion, and the read-first Location page.
The P4 UI now fully implements wireframe B2 on the app design tokens (was an
approximation): per-type colour badges, OK/Check/Fail LED status chips,
inline CTAs, the Phius/PHI peak-load tiles, the fail-page "Certification
blocker" hero, and a read-first Location page with an Edit-reveal editor.
The ASHRAE/EPW/peak temperature tiles, which had hardcoded `°C`, now follow
the app-wide SI/IP preference (D-CL-21).

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
  *(Update 2026-06-22: the dev DB now seeds PHI — the climate-dataset-picker P4
  wired the dev seed to seed every published provider, so a re-run would no
  longer warn. O5 below — confirming the seeded **versions** are a valid cert
  basis — is a separate concern and stays open.)*
- `make format` — passed.
- `make ci` — passed: backend `935 passed, 2 skipped`; frontend `186` test
  files / `1784` tests passed; Vite build passed.

## P4 verification (2026-06-21)

- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateRecordTable.test.tsx src/features/climate/__tests__/chart-data.test.ts src/features/climate/__tests__/ClimateSourcesSection.test.tsx src/features/climate/__tests__/ClimateTab.test.tsx src/features/climate/__tests__/sun-path.test.tsx` — 19 passed. *(Historical 2026-06-21 gate; the Climate-page sun-path test was removed on 2026-06-22.)*
- `cd frontend && pnpm exec tsc --noEmit` — passed.
- Playwright live smoke on `http://localhost:5173` + backend `8000` —
  passed. Smoke project `3a7d86b5-60b5-4186-998b-d0388f19852f`; derive
  attached `phius`, `ashrae`, and `epw` rows; Location rendered the site
  context, EPW rendered HDD/CDD + source/download links, and mobile ASHRAE rendered
  design-condition tiles without header overlap. Dev DB still lacks a PHI
  seed, so the smoke emitted the expected PHI warning. Screenshots:
  `/tmp/phn-climate-p4-location.png`, `/tmp/phn-climate-p4-epw.png`,
  `/tmp/phn-climate-p4-mobile-ashrae-fixed.png`.
- `make format` — passed.
- `make ci` — passed: backend `935 passed, 2 skipped`; frontend `187` test
  files / `1787` tests passed; Vite build passed. Existing warnings only:
  backend HTTP 413 deprecation, frontend fast-refresh/act warnings, and Vite
  chunk-size warnings.

## P4 UI fidelity pass (2026-06-21)

Brought the Climate tab from an approximation to a full implementation of
wireframe B2 on the app design tokens; fixed the D-CL-21 `°C` hardcode.

- Rebuilt `ClimateSourceSidebar` (location card with decorative map + pills +
  privacy marker, source cards with `data-kind` badges + status edges + ★ +
  LED OK/Check/Fail chips + inline CTAs, dashed add affordance),
  `ClimateSourceDetailPage` (shared page-head with Set-default/Remove actions,
  Phius/PHI peak-load tiles, fail-page hero + candidate verdict table), and
  the `ClimateTab` Location page (read-first facts + map, Edit ▸
  reveal). New atoms in `components/ClimateAtoms.tsx`. Badge tints are
  token-derived (`--accent`/`--chart-*`); no new hex.
- `cd frontend && pnpm exec vitest run src/features/climate` — 34 passed;
  `pnpm exec tsc --noEmit` — passed.
- Live Playwright (project `3a7d86b5-…`): Location / Phius / ASHRAE pages
  render B2 structure; SI↔IP toggle flips every temp tile + elevation pill.
- `simplify` skill applied (className/elevation/privacy/subItems cleanups).
- Final `make format` + `make ci` are the closing gate (in progress).

## Location sun-path removal (2026-06-22)

- Removed the entire `climate-sunpath-panel` from the Climate Location page.
  The page now owns the site map, read-first derived facts, and Set Location
  modal; sun visualization remains in the Model tab.
- Removed the Climate-only frontend sun-path component/helpers/tests and the
  backend project-location `/sun-path` route/service/MCP tool that served that
  panel.
- Focused verification passed: `cd frontend && pnpm exec vitest run src/features/climate/__tests__/ClimateTab.test.tsx`,
  `cd frontend && pnpm run build`, `cd backend && uv run pytest tests/test_project_location.py tests/test_mcp.py`,
  `make format`, `git diff --check`, and live browser verification on
  `http://localhost:5173`.
- Full `make ci` intentionally deferred until session close per Ed.

## Set Location modal scope split (2026-06-22)

- Simplified the Set Location modal to address search, pin-drop coordinates,
  elevation, time zone, true-north, and Save Location only.
- Moved `Locate Climate Data` to the main Location page so derive/repopulate
  operates on the saved project location instead of being bundled into the
  editor modal.
- Moved the EPW source URL, EPW upload, EPW download, and parsed-header apply
  controls onto the EPW page placeholder/detail surface. Backend EPW routes are
  unchanged.

## P5 implemented on branch — elevation auto-fill on Set Location (2026-06-22)

- Phase plan: `phases/phase-05-elevation-autofill-on-set-location.md`. Built on
  branch `feat/elevation-autofill`.
- Gap it closed: the modal owned the elevation field but never filled it —
  elevation only auto-derived via the Location-page `Locate Climate Data`
  (`/derive`), so a freshly set site persisted `elevation_m = NULL`.
- Backend: new side-effect-free `POST …/location/elevation`
  (`lookup_site_elevation`) reusing `fetch_elevation_geodata`
  (USGS 3DEP → Open-Meteo); no persistence, no source attach. A shared
  `RequiredCoordinatesRequest` base now backs both the derive and elevation
  request models.
- Frontend: `useProjectLocationForm` auto-fills the elevation input on a
  coordinate change (candidate-apply / pin-drop / valid manual lat-long) via a
  debounced watcher, with a sticky manual override and a "Reset to auto"
  affordance in the Set Location modal. Applying a new geocode candidate clears
  the override (fresh-location gesture).
- Decisions accepted and folded into `decisions.md`: D-CL-27 (separate endpoint,
  not `/derive`), D-CL-28 (server-side lookup, not client→USGS), D-CL-29
  (project-scoped + editor-gated).
- Tests green: backend `test_project_location.py` (25); frontend
  `SetLocationModal` + `location-form` (14); `tsc` clean. Merge/full-CI pending.

## Phius/PHI source detail content (2026-06-22)

- Reworked the PH dataset detail page from the old table/chart toggle into two
  always-visible sections: Monthly data and Peak loads.
- Monthly data now shows both line charts (temperature, radiation) and exact
  monthly value tables. Peak loads now render as a table only.
- Added a focused ClimateTab regression for the attached Phius detail path so
  the page cannot silently render blank again.
