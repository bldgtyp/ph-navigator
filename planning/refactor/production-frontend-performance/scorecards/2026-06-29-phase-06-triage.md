---
DATE: 2026-06-29
TIME: 20:27 EDT
STATUS: Phase 06 triage + assessment recorded; fix/budget decisions proposed,
  awaiting Ed's go on each.
AUTHOR: Claude (Opus 4.8)
SCOPE: Triage of the production frontend performance baselines (Phase 02 public
  + Phase 04 authenticated) into ranked recommendations and investigation items.
RELATED:
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-02-public-baseline.md
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-04-authenticated-readonly.md
  - planning/refactor/production-frontend-performance/PLAN.md
  - context/PRODUCTION_DEPLOYMENT.md
---

# Phase 06 - Triage And Assessment

## Bottom Line

**The production frontend is in good shape.** Across the public shell and all
10 authenticated routes (250-row fixture): zero long tasks anywhere, loads
~0.24-0.32 s, interactions settle ~0.27-0.30 s, no failed routes, no console
errors. There is **no performance emergency and nothing here should block
shipping.** The findings below are optimizations and one cosmetic-perception
item, not defects.

This assessment is evidence-bound to two scorecards (Phase 02, Phase 04) taken
2026-06-29 against `www.ph-nav.com` with browser-side timing only. No Render
API-latency correlation was run, so backend-attributed items carry that caveat.

## Findings Ranked (impact x effort)

Impact = how many users feel it x how much. Effort = implementation + risk.

| # | Finding | Layer | Impact | Effort | Recommendation |
|---|---|---|---|---|---|
| 1 | Static assets served `cache-control: max-age=0` | Infra/config | Low-Med (every repeat visit pays revalidation; fonts ~53 KB refetch) | **Low** (config-only) | **Do it** — best ratio in the packet |
| 2 | `equipment` fans out to ~14 type-scoped GETs + a full draft fetch | API/data | Low (37 KB, 0 long tasks; felt only on slow links) | Med (needs investigation first) | **Investigate, then decide** |
| 3 | `climate` LCP 1.9 s (Leaflet map tile) | FE/render | Low (one route; map is the point of the page) | Med-High | **Document as expected**; optional polish |
| 4 | Per-route JS chunk weight (status 103 KB, spaces 178 KB, equipment 200 KB transfer) | FE/payload | Low (loads still < 0.32 s) | Med | **Watch only** — no action now |

### Finding 1 — asset cache policy (recommended fix)

Root cause is now known: the Render static-site block in `render.prod.yaml`
(and `render.yaml`) has **no `headers:` rule**, so assets get Render's default
`Cache-Control: public, max-age=0`. Filenames are already content-hashed
(`index-<hash>.js`, `Geist-300-latin-<hash>.woff2`), so they are safe to cache
forever.

- **Fix:** add a `headers:` entry to the static service for `/assets/*` setting
  `Cache-Control: public, max-age=31536000, immutable`. Keep `index.html` at
  `max-age=0` (it must stay revalidated so new deploys are picked up).
- **Effect:** warm navigations drop their per-asset revalidation round-trips;
  fonts stop re-downloading (~53 KB saved per repeat visit).
- **Risk:** very low, but **must scope to `/assets/*` only** — a blanket
  immutable rule on `index.html` would pin users to a stale build. Verify the
  exact Render `headers` syntax against their static-site docs, and confirm
  Cloudflare in front isn't separately overriding `Cache-Control`.
- This is the one item worth turning into a small follow-up refactor.

### Finding 2 — equipment fan-out (investigate first)

The equipment load issues ~14 type-scoped requests — seven
`…/draft/tables/<type>` plus seven `…/table-views/<type>` — **and** a full
`…/draft` document fetch. `draft/tables/{table_name}` and `table-views/{table_name}`
are confirmed per-name endpoints (`backend/features/project_document/routes.py`,
`backend/features/table_views/routes.py`).

Open question before any change: **the full draft document already contains all
tables — why does the page also fetch each table individually?** Either the
per-table endpoints return something the draft doesn't (server-computed views,
pagination over 250 rows), or this is redundant fetching. That answer decides
the fix:

- If redundant → drop the per-table data calls; read from the already-fetched
  draft. Frontend-only, meaningful request reduction.
- If the per-table endpoints are load-bearing → consider a batch
  `table-views` endpoint (one call returns all requested view configs) to
  collapse the 7 `table-views` round-trips.

Do not act until the redundancy question is answered. Low user impact today (no
long tasks, 37 KB), so this is not urgent.

### Finding 3 — climate map LCP (EXPECTED — accepted, closed)

LCP element is an `img.leaflet-tile-loaded` (load 1.9 s) from the external tile
provider; the app shell itself responds at 256 ms. This is inherent to a
map-first page, not an app defect.

**Decision (Ed, 2026-06-29): accepted as expected behavior; no action.** The
climate route's ~1.9 s LCP is the external Leaflet map tile, not an app
regression. Future perf runs that see this number should treat it as the
documented baseline for this route, not a defect to chase. If it is ever
revisited (optional, low value): a tile skeleton/placeholder, a lighter initial
zoom, or excluding the map from LCP candidacy.

## Budget / Gate Decisions

Per the PLAN's Phase 06 goal ("decide whether any metric becomes a check,
budget, or recurring smoke"):

- **No CI perf gate yet.** One run is not a calibrated baseline, the matrix
  needs production credentials + a seeded fixture (not CI-friendly), and the
  app is healthy — a gate now would be noise. Reconsider only after Finding 1
  ships and a second run confirms the warm-load improvement.
- **Keep the existing public smoke** (`/ready`, shell 200, apex 301) as the
  lightweight recurring check; it needs no credentials. If we ever want a
  recurring perf signal, the public Phase 02 capture (cold/warm shell timing,
  no login) is the only credential-free piece and the natural candidate.
- **Long-task count is the metric I'd eventually gate on**, not LCP/load — it
  is the cleanest "did we introduce jank" signal and was a clean 0 everywhere.
  Defer until there is a reason.

## Areas Needing Further Investigation

1. **Equipment redundant-fetch question** (Finding 2) — read the equipment page
   data-loading code; confirm whether per-table fetches duplicate the draft.
2. **Cloudflare vs Render header precedence** — before Finding 1, confirm which
   layer wins on `Cache-Control` so the fix lands where it takes effect.
3. **Per-route cold/warm separation for authenticated pages** — the Phase 04
   matrix is a single warm-shell pass. If warm-route numbers matter, the
   harness needs a cold/warm variant (the agreed cold/warm coverage was met at
   the public-shell level only).
4. **Render API-latency correlation** — browser-only timing can't split
   frontend vs backend. Worth one correlated run if Finding 2 is promoted, to
   confirm the fan-out is latency-bound and not just count-bound.
5. **Larger-fixture stress** — this was 250 rows. The archived local stress tier
   went higher; a 1000-row production pass would show whether any route
   degrades non-linearly (esp. the table-heavy spaces/equipment routes). Only
   if there's appetite; current numbers give no reason to expect trouble.

## Recommended Next Steps (in order)

1. **Ship Finding 1** as a small `render.prod.yaml` + `render.yaml` headers
   change (scoped to `/assets/*`, `immutable`). Re-run the Phase 02 public
   capture after deploy to confirm warm-load no longer refetches fonts.
2. **Investigate Finding 2** (equipment redundant fetch) — a reading task, no
   change yet; decide frontend-dedupe vs batch endpoint from what it shows.
3. **Document Finding 3** (climate map) wherever map behavior is noted; no code.
4. Hold Phase 05 (write-path timing) unless a specific write-latency question
   arises; it needs separate explicit approval and only the seeded fixture.
5. Revisit a CI/budget gate only after Finding 1 ships and a second baseline
   exists.

## Status Of This Packet After Phase 06

Phases 00-04 complete and scored; Phase 06 assessment recorded. Phase 05
deferred. The packet's open work is now the three concrete follow-ups above,
each of which can be its own small change — none require keeping this
investigation packet "open."
