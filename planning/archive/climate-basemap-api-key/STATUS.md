# STATUS — Climate Basemap API Key

DATE: 2026-10-24
TIME: 17:05 EDT
STATUS: `Complete` — merged via PR #104, deployed to production 2026-10-24,
www.ph-nav.com verified by Ed the same day
AUTHOR: Claude (with Ed May)
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/103 (closed 2026-10-24)

## Current state

Implementation complete per PLAN.md Option A and verified in production:

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

None — done. Production verified by Ed on 2026-10-24 after the "Deploy
Production" workflow ran: the www.ph-nav.com Climate page (and the other
map surfaces) render real CARTO Positron tiles with the © CARTO
attribution line, no watermarks. The packet moves flat-by-slug to
`planning/archive/climate-basemap-api-key/`.

## Blockers

- None technical. Render CLI token expired during the session; blueprint
  validation ran as local YAML parse — re-run `render blueprints validate
  ./render.prod.yaml` at the PR gate after `render login`.
