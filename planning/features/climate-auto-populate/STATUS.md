---
DATE: 2026-06-21
TIME: 13:02 EDT
STATUS: Active — P1 complete on branch; P2 next.
  Design decisions accepted (D-CL-12..24, O-units). Open items are operational only.
AUTHOR: Ed (via Claude)
SCOPE: Current state of the climate auto-populate feature.
RELATED:
  - README.md, PRD.md, decisions.md, research.md
  - phases/phase-01..04
---

# Climate Auto-Populate — Status

## Current state

`Active — P1 complete`. PRD, decisions, research, and four phase plans logged.
Phase 1 implementation now extends `project_location` with derived public
geodata, editor-only geocode/derive endpoints, a committed PNNL 2021 IECC
county-zone CSV, and a Climate-tab editor action that populates
county/state/elevation/climate-zone from coordinates. Builds on the shipped
climate store (archived Phases 1–3): app-wide Phius/PHI datasets,
`project_climate_source`, sun-path, and the dataset browser all exist and are
reused.

## Next step

Planning is complete — all design decisions accepted (D-CL-12..24, O-units).
**Current implementation loop: start P2.** Suggested next entry points:

1. **P2 (Phius/PHI auto-pin + proximity flags)** is the next dependency step
   after P1 gates, using the derived coordinates/elevation plus existing
   `climate_dataset_location` nearest search.
2. **P4 (the new tab)** can still lead independently for an early UX win — nav
   sidebar + per-type pages (D-CL-20), styled with app CSS/brand tokens (the
   wireframe `working/climate-tab-wireframe-B2.html` is structure only).
3. Before P2 ships proximity flags, confirm **O5** (seeded Phius/PHI dataset
   versions are a valid current cert basis). Procure **O4** keys (MapTiler /
   Open-Meteo) before relying on free tiers.

Remaining open items are operational only: O4 (API keys), O5 (dataset
versions), O6 ("custom set required" workflow + custom-record editor), O7
(EPW catalog refresh cadence).

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
