---
DATE: 2026-06-29
TIME: 20:22 EDT
STATUS: Phase 04 authenticated read-only matrix captured against production.
AUTHOR: Claude (Opus 4.8)
SCOPE: Read-only production route-matrix scorecard for the seeded PERF-STRESS
  fixture.
RELATED:
  - planning/refactor/production-frontend-performance/PLAN.md
  - planning/refactor/production-frontend-performance/STATUS.md
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-02-public-baseline.md
---

# Phase 04 - Authenticated Read-Only Baseline Scorecard

## Run Metadata

- Target frontend: `https://www.ph-nav.com`
- Target API: `https://api.ph-nav.com`
- Account: `codex@testing.com` (dedicated production testing account).
- Fixture: `PERF-STRESS`,
  `PERF_PROJECT_ID = ce77af67-8994-4174-89d6-a59e3bd6189e`, version
  `57945a36-5831-4b9c-93e7-3c82a7ea37eb`; 250-row tables; Climate (PHI 10.6 +
  Phius 2022, NY Central Park) and Apertures/Envelope present; no 3D Model.
- Harness: `frontend/tests/e2e/perf/perf-matrix.spec.ts`, Playwright Chromium
  1.60.0, headless, 1 worker.
- Mode: `PHN_PERF_PRODUCTION=1 PHN_PERF_READONLY=1` — no write endpoints called;
  cell edits replaced by non-mutating hovers; recovered-draft dialog refused
  rather than discarded.
- Result: **10/10 routes passed in 48.1s.** Model route excluded by design.
- Password never stored in repo or logged; supplied at run time from a
  session-scratchpad file via `E2E_PASSWORD="$(cat …/perf_pw)"`.

## Per-Route Results

All times in ms; Xfer = sum of resource `transferSize` for that load; API# =
backend requests during load + scripted interaction.

| Route | TTFB | DCL | Load | LCP | Interact | LongTasks | Res# | Xfer KB | API# | API KB |
|---|---|---|---|---|---|---|---|---|---|---|
| dashboard | 257 | 300 | 300 | 316 | 277 | 0 | 12 | 2.9 | 5 | 0.8 |
| status | 201 | 245 | 245 | 260 | 277 | 0 | 14 | 103.5 | 6 | 1.1 |
| spaces | 201 | 248 | 249 | 264 | 282 | 0 | 27 | 178.6 | 9 | 18.0 |
| equipment | 214 | 256 | 256 | 272 | 278 | 0 | 30 | 200.1 | **19** | 37.3 |
| apertures | 205 | 261 | 261 | 280 | 268 | 0 | 33 | 116.7 | 11 | 12.5 |
| envelope | 198 | 249 | 249 | 268 | 283 | 0 | 36 | 109.9 | 5 | 2.3 |
| climate | 254 | 316 | 317 | **1920** | 298 | 0 | 22 | 240.9 | 7 | 1.7 |
| materials-catalog | 201 | 251 | 252 | 272 | 279 | 0 | 25 | 145.0 | 4 | 11.5 |
| frame-types-catalog | 215 | 270 | 270 | 368 | 281 | 0 | 23 | 143.4 | 5 | 8.3 |
| glazing-types-catalog | 193 | 238 | 239 | 252 | 279 | 0 | 23 | 143.0 | 5 | 2.9 |

## Reading

- **Main thread is healthy everywhere: zero long tasks on all 10 routes.** No
  JS jank under a 250-row fixture. Scripted interaction settles in ~270-300 ms
  on every route.
- **Loads are fast: TTFB ~0.2 s, Load ~0.24-0.32 s** across routes. The shell
  JS/CSS/fonts are edge-cached and 304-revalidate (transfer ~300 B each), so
  per-route cost is the lazy route chunk plus its API data.
- **One clear LCP outlier: `climate` at 1920 ms.** The LCP element is a Leaflet
  **map tile** (`img.leaflet-tile-loaded`, loadTime 1909 ms) served from the
  external tile provider. The page shell responds at 256 ms; the map tile is
  the dominant paint and arrives ~1.9 s in. Every non-map route paints LCP
  under 370 ms.

## Findings (for Phase 06 triage)

1. **`equipment` fans out to ~14 type-scoped requests on one load (19 total).**
   Seven `…/draft/tables/<type>` data calls plus seven `…/table-views/<type>`
   view-config calls (pumps, fans, ventilators, hot_water_heaters,
   hot_water_tanks, electric_heaters, appliances). Each is small (37 KB total),
   but it is the chattiest route by far (next is `apertures` at 11). Candidate:
   batch the per-type table + view-config fetches, or fold `table-views` into
   the draft-tables response. Backend/API concern, not a render concern.

2. **`climate` LCP ~1.9 s is map-tile bound, not app-bound.** Not a code defect,
   but it is the slowest perceived route. If it matters, options are a tile
   placeholder/skeleton, a lighter initial zoom, or marking the map non-LCP.
   Low priority; document as expected map behavior.

3. **Carryover from Phase 02 (still the top low-risk fix):** content-hashed
   static assets are served `cache-control: max-age=0`, forcing per-navigation
   revalidation. In this authenticated matrix the shell assets 304 cheaply, but
   `immutable, max-age=31536000` would remove the revalidation round-trips
   entirely. Verify whether the header originates at the Render static service
   or a Cloudflare Cache Rule before changing it.

No correctness issues, no failed routes, no write endpoints touched, no console
errors surfaced by the harness.

## Method Caveats

- This is a **single warm-shell pass**: login pre-warms the shell JS/CSS/fonts,
  so per-route numbers reflect a cold *route chunk* on a warm *shell*. The
  matrix does not separate cold-vs-warm per authenticated route. The agreed
  "both cold and warm" coverage was satisfied at the public-shell level in the
  Phase 02 scorecard; per-route cold/warm separation for authenticated pages
  would need a harness change and is deferred (note for Phase 06).
- Browser-side timing only; Render API latency not correlated this pass (per
  Phase 00 decision). Findings 1 looks API-bound — correlate with Render if it
  is promoted to a fix.
- Raw per-route metrics JSON is under the gitignored
  `frontend/test-results/*/<route>-metrics.json` for this run.

## Next

- Phase 05 (write-path timing inside `PERF-STRESS`) remains deferred pending a
  separate explicit approval.
- Phase 06 triage: rank Finding 1 (equipment fan-out) and Finding 3 (asset
  cache policy) as the actionable candidates; Finding 2 (climate map) as
  documented-expected.
