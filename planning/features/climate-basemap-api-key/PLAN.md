# PLAN — Climate Basemap API Key

DATE: 2026-10-24
TIME: 15:33 EDT
STATUS: `In review` — implemented per Option A; see STATUS.md for state
AUTHOR: Claude (with Ed May)
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/103

## Part 0 — Ed: request the key (outside the repo, ~5 minutes)

1. Open <https://dashboard.basemaps.carto.com/> in **Chrome** (the
   `ed@bldgtyp.com` browser) — the signup form lives on that page if the
   marketing page's embedded form does not load.
2. Enter `ed@bldgtyp.com`. CARTO emails a magic link (no password); click it
   to land on the key dashboard.
3. On the dashboard, create a key. Give it a recognizable name, e.g.
   `ph-nav-production`.
4. Set the allowed referrer restriction for the key to
   `*.ph-nav.com/*` (covers `www.ph-nav.com`). Leave localhost rules off the
   production key.
5. Note the tier at signup: **Commercial (free to 1M req/month)** fits
   ph-nav. Nothing to pay; the dashboard offers upgrades only past the tier.
6. Optionally create a second key `ph-nav-dev` restricted to
   `localhost:*` for local development, so the two usage streams are
   separately visible on the dashboard.
7. Hand the key(s) over via the scratchpad convention (never pasted into a
   terminal): put them in a gitignored `working/` file or the Render
   dashboard directly when we wire the production env var.

## Part 1 — Frontend implementation (agent, after Ed approves this plan)

### Step 1 — Plumb the key through Vite env

- `frontend/.env.example`: add `VITE_CARTO_BASEMAP_KEY=` with a comment
  noting where to get one (carto.com/basemaps/apikey) and that it is a
  public, referrer-restricted credential.
- `.gitignore`: confirm `.env*` patterns already cover the frontend dir
  (they do today for `VITE_API_BASE_URL` overrides — verify, don't assume).
- No `frontend/.env` is committed; local devs create their own from the
  example. The Vite config needs no change: `import.meta.env` picks up
  `VITE_*` automatically.

### Step 2 — Thread the key into the basemap table

`frontend/src/features/climate/components/climateLeafletMap.ts` is the
single tile source for every consumer (the controller bag serves the
Climate page, picker, Set-Location modal, and sidebar mini-map). Changes:

- Type: add a module-level `const CARTO_KEY = import.meta.env
  .VITE_CARTO_BASEMAP_KEY as string | undefined` near the attribution
  constants.
- Helper: `cartoUrl(path: string): string` returning
  `https://{s}.basemaps.cartocdn.com${path}${CARTO_KEY ?
  '?key=' + encodeURIComponent(CARTO_KEY) : ''}`.
- The two CARTO entries (`carto-positron`, `carto-positron-no-labels`)
  build their `url` through the helper. `osm-standard` is untouched
  (keyless, per OSM policy fine at this volume for dev/fallback).
- Keyless degradation: if `CARTO_KEY` is empty, the CARTO styles resolve to
  URLs we now know return watermark placeholders. Per the PRD contract
  (#3), the default style should then fall back rather than render
  watermarks:
  - In `ClimateMap.tsx`, the default `basemapStyle = "carto-positron"`
    becomes `CARTO_KEY ? "carto-positron" : "osm-standard"` (one ternary;
    callers that explicitly pass a CARTO style keep it — their choice is
    honored, and the module doc comment explains why).
- Update the module header comment in `climateLeafletMap.ts`: D-DP-6's
  "keyless" phrasing is now historical; point at this packet + issue.

### Step 3 — Tests

- Existing tests run on the `placePins` fallback (`LIVE_MAP` false in
  jsdom) and never touch tile URLs — verify, don't assume; if any test
  imports the basemap table directly, assert the keyless default resolves
  to `osm-standard`.
- Add one focused unit test: with `VITE_CARTO_BASEMAP_KEY` unset, the
  default basemap style is `osm-standard`; with it set (vitest env stub),
  the CARTO URL template carries `?key=…`.
- No new component tests beyond that: the map behavior contract is already
  covered by the picker/SetLocation suites.

### Step 4 — Verification (local)

- `make frontend-dev-check` and `make format` green.
- Manual browser pass via `make agent-browser-ready` + the fixture project:
  Climate page map, dataset picker map, Set-Location modal, sidebar
  mini-map all render real tiles with the dev key set; with the env var
  absent they render OSM Standard (not watermarks). Attribution line
  visible throughout.
- `make ci` before any PR.

## Part 2 — Production deployment (explicit, separate — Ed's call)

Production deploys are manual by policy (Render auto-deploy off); nothing
here auto-deploys.

1. Set `VITE_CARTO_BASEMAP_KEY` in the Render frontend environment
   (dashboard or `render env-vars` — Ed performs the secret entry per the
   usual no-secret-in-terminal rule).
2. Trigger the production deploy explicitly when ready.
3. Verify on `https://www.ph-nav.com` Climate page: real tiles, attribution
   intact, no watermark.
4. Fold the outcome back: D-DP-6's tiles half gets a superseding note in
   the archived packet pointer or `context/` if a basemap contract line
   exists; update this packet's STATUS to `Complete`; the PR closes #103.

## Risks / notes

- **Key rotation**: the key is public-facing; referrer restriction limits
  abuse. If it ever needs rotating, it's a new env var value + redeploy,
  nothing else.
- **Referrer mismatch gotcha**: CARTO referrer rules apply to the `Referer`
  header; production serves `www.ph-nav.com` — test the rule with the key
  dashboard's checker before deploying, or the map comes back watermarked
  in production with a valid key.
- **Usage monitoring**: the CARTO dashboard shows monthly usage per key;
  no alerting hook is planned (volume is nowhere near 1M).
