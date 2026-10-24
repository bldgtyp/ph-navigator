# PRD — Climate Basemap API Key

DATE: 2026-10-24
TIME: 15:33 EDT
STATUS: `Scoped`
AUTHOR: Claude (with Ed May)
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/103

## Problem

Every live map in the climate area (Climate page, climate-dataset picker,
Set-Location pin-drop modal, Overview sidebar mini-map) renders CARTO
Positron raster tiles from `basemaps.cartocdn.com` **without an API key**.
That keyless access ended: CARTO announced the Basemaps API-key requirement
on 2026-09-23 and now serves an HTTP-200 placeholder tile stamped
"API KEY REQUIRED" to keyless clients. The failure is silent — the tile-load
tracker counts the placeholder as a successful load — so production shows a
watermarked grey grid instead of a map.

The keyless-tile assumption was an explicit, recorded decision (D-DP-6 in
`planning/archive/dated/2026-06-22/climate-dataset-picker/decisions.md`:
"vanilla Leaflet + keyless OSM raster — no key, no proxy, no committed
secret"). This feature supersedes the tiles half of that decision; Leaflet
and the test fallback contract are unaffected.

## CARTO's new terms (verified 2026-10-24 from carto.com/basemaps/apikey)

- **Non-commercial**: free up to 5M tile requests/month (personal, research,
  teaching, non-profits).
- **Commercial**: free up to 1M requests/month; above that $500/month to 10M
  (Basemaps Commercial) or $1,500/month to 50M (Commercial Plus).
- The key is requested by a person at <https://dashboard.basemaps.carto.com/>
  (magic-link email sign-in, no password). The dashboard shows per-key usage
  and supports referrer restrictions and multiple keys.
- The key travels as a `?key=` query parameter on every tile URL — a public,
  referrer-restrictable browser credential, not a server secret.
- Attribution (© OpenStreetMap contributors, © CARTO) must remain visible.
  The app already renders it.

ph-nav's traffic (small user base, map views only on the climate surfaces)
sits far below the 1M commercial free tier. Ed selects the account tier at
signup; ph-nav qualifies as commercial-use-free at 1M.

## Behavior contract

1. All four live map surfaces render real Positron tiles again, with the
   CARTO + OSM attribution line intact.
2. The key reaches the tile URL templates without being committed to the
   repository (public repo; the key is a public-tier credential but must
   still not land in git history).
3. A missing key is a **build/configuration-time failure mode, not a
   runtime crash**: with no key configured, maps degrade to the existing
   positioned-pin fallback (or OSM Standard) rather than requesting
   watermarked placeholder tiles.
4. The tile-loading tracker keeps reflecting genuine tile-load state
   (loading → settled), unchanged.
5. Unit tests stay green with no key present: tests run on the `placePins`
   fallback path and never request network tiles; the key is a config
   concern the tests stub or omit, not a component dependency.
6. `osm-standard` remains available as a keyless style for local
   development and as a permanent fallback.

## Non-goals

- No change of renderer (vanilla Leaflet stays; D-DP-6's renderer half is
  untouched).
- No vector-tile / MapLibre migration.
- No backend proxy for tiles (CARTO's free tiers are browser-key based;
  a proxy would add infra for no licensing gain at this volume).
- No per-user or per-project key handling — one firm-wide key.

## Open question for Ed before implementation

**Key injection mechanism** — PLAN.md Option A (Vite build-time env var,
`import.meta.env.VITE_CARTO_BASEMAP_KEY`, empty-string default) is
recommended and drafted as the plan of record. Option B (backend-served
public config endpoint) was considered and rejected for now: it adds a
route, caching, and a settings entry for a value that is public anyway.
Say the word if you'd rather have B.
