# STATUS — Climate Basemap API Key

DATE: 2026-10-24
TIME: 16:35 EDT
STATUS: `Merged to main` — PR #104 merged 2026-10-24; production deploy +
www.ph-nav.com verification pending before archive
AUTHOR: Claude (with Ed May)
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/103

## Current state

Implementation complete per PLAN.md Option A:

- New `frontend/src/features/climate/components/climateBasemap.ts` —
  Leaflet-free basemap catalogue; reads `VITE_CARTO_BASEMAP_KEY` at call time;
  appends `?key=` to CARTO tile URLs; `defaultBasemapStyle()` degrades to
  `osm-standard` when no key is configured.
- `climateLeafletMap.ts` consumes the catalogue (Leaflet stays lazy-loaded).
- `ClimateMap.tsx` default style resolves via `defaultBasemapStyle()`.
- `.env.example` documents the variable; `render.prod.yaml` declares it as
  `sync: false` on `ph-navigator-web`; `context/PRODUCTION_DEPLOYMENT.md`
  lists it among dashboard-entered secrets.
- 7 focused unit tests (`climateBasemap.test.ts`).

## Verification carried out

- `make ci` green (288 files / 2554 tests) — under Node 22, the version CI
  pins. Note: the shell default here is Node 26, which fails ~106 unrelated
  tests with `Cannot read properties of undefined (reading 'clear')`; clean
  tree reproduces, so environmental, not this change.
- Browser-verified locally with Ed's `localhost`-restricted CARTO dev key:
  Climate page + sidebar mini-map render real CARTO Positron tiles, no
  watermark, attribution line shows © OpenStreetMap contributors © CARTO.
- Keyless fallback verified in-browser (empty key → OSM Standard tiles render).
- Keyed URL verified by curl with the production key + `www.ph-nav.com`
  referer (real tile returned); localhost referer correctly 403s against the
  production key (referrer restriction working as designed).

## Next step

Merged to main via squash PR #104 (issue #103 closes on deploy per the
issue-close commit reference — confirm when verifying production).
`VITE_CARTO_BASEMAP_KEY` is already set on `ph-navigator-web` in Render
(production key). Remaining: trigger the "Deploy Production" GitHub
Actions workflow (the only deploy trigger; never agent-triggered), verify
the www.ph-nav.com Climate page (hard-refresh first — keyless-era
placeholder tiles were served with a 30-day cache TTL), then archive
per PLAN.md Part 2.

## Blockers

- None technical. Render CLI token expired during the session; blueprint
  validation ran as local YAML parse — re-run `render blueprints validate
  ./render.prod.yaml` at the PR gate after `render login`.
