# STATUS — Climate Basemap API Key

DATE: 2026-10-24
TIME: 16:35 EDT
STATUS: `In review` — implemented on the working tree (not yet committed); CI
green; pending Ed's commit/PR decision and the production deploy
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

Ed commits (branch + PR per the usual loop, `Closes #103`), then Part 2 of
PLAN.md: set `VITE_CARTO_BASEMAP_KEY` in the Render dashboard for
`ph-navigator-web` (production key, not the localhost dev key), explicit
production deploy, and verify www.ph-nav.com Climate page. Then archive.

## Blockers

- None technical. Render CLI token expired during the session; blueprint
  validation ran as local YAML parse — re-run `render blueprints validate
  ./render.prod.yaml` at the PR gate after `render login`.
