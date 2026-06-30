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
| 2 | `equipment` fans out to 14 type-scoped GETs (7 draft-tables + 7 table-views) | API/data | Low (37 KB, 0 long tasks; felt only on slow links) | Med (needs investigation first) | **table-views half ✅ DONE (batch on branch); draft-tables half open** |
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

The equipment load issues 14 type-scoped requests — seven
`…/draft/tables/<type>` (data) plus seven `…/table-views/<type>` (view/column
config). `draft/tables/{table_name}` and `table-views/{table_name}` are confirmed
per-name endpoints (`backend/features/project_document/routes.py`,
`backend/features/table_views/routes.py`).

**Correction (verified against the run's `equipment-metrics.json` and the
backend routes, 2026-06-29):** an earlier draft of this finding claimed the load
"already fetches the full draft document, which contains all tables." That is
wrong. The single `…/draft` call on this load hits `GET …/draft` →
`ProjectDraftSummary` (`models.py:47`) — a **status/metadata** object
(`version_etag`, `draft_etag`, `dirty_tables: list[str]` of names only, lock /
`can_edit` flags). It carries **no table rows**. The only endpoint that returns
the whole document with every table is `GET …/document` → `ProjectDocumentV1`
(`routes.py:64`), and the equipment page **never calls it** (confirmed: not in
the captured request set). So the per-table data calls are not redundant with
anything currently loaded — they are the page's only source of table rows.

Data-path question, restated correctly (full write-up + phased plan at
`planning/refactor/batch-draft-table-reads/`): the 7
`…/draft/tables/<type>` reads each re-assemble and re-validate the **whole
draft** server-side (`get_draft_table_slice` → `get_current_document_view` →
`load_current_document_parts`) and return one table. So the data is co-located;
the fan-out wastes 6 round-trips *and* 6 whole-draft loads per mount.

The collapse target is **not** `GET …/document` — that returns the **saved**
version (`ProjectDocumentV1`), which diverges from the draft once there are
unsaved edits, and there is no whole-*draft* GET today. A collapse needs a new
batch/whole-draft **draft** read that seeds the per-table caches on mount.

Crucially, the per-table split is **partly load-bearing and must not regress**:
PR #18 (`equipment-draft-etag-coordination`, merged 2026-06-29) established that
all tables share one document-level draft etag, a write to any table invalidates
every other table's cached slice, and `resolveSliceForWrite` refetches a table
fresh before its write so `If-Match` carries the current etag. That protocol
(per-table cache entries + invalidate-others + refetch-before-write) is the fix
for the "edit table A, go to B, B's edit is blocked" bug and is covered by
`table-draft-etag-coordination.spec.ts`. A collapse may only remove the
**initial-mount fan-out** (via batch-seed); it must keep the per-table query +
refetch machinery intact. That makes it a larger, riskier change than the
table-views batch — **defer it behind the table-views batch.**

Independent of all the above, the 7 `…/table-views/<type>` calls are pure
per-table view/column config (`view_state` JSON, per user+project+table),
**orthogonal to the draft etag protocol**, and cleanly batchable: a single
`GET …/table-views?keys=…` collapses 7 round-trips into 1 with no coordination
risk. This is the lowest-risk win — written up and planned at
`planning/refactor/batch-table-views-endpoint/`.

> **✅ DONE (2026-06-29) — table-views half.** Implemented on branch
> `refactor/batch-table-views-endpoint`: backend batch route
> `GET /api/v1/projects/{id}/table-views?keys=…` + a frontend page-scoped batch
> read-through wired into the equipment page (its 7 `table-views` reads collapse
> to 1). `make ci` green; the 7→1 collapse is unit-test-proven. The empirical
> perf re-run (`equipment` 19 → ~13) is a user-gated step (production fixture);
> see that packet's `phases/phase-03-verification.md`. **The draft-tables half
> of this finding remains open** under `planning/refactor/batch-draft-table-reads/`.

Low user impact today (no long tasks, 37 KB), so this is not urgent.

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

1. **Equipment data-path question** (Finding 2) — read the equipment page
   data-loading code; decide whether one `GET …/document` could replace the 7
   `…/draft/tables/<type>` reads (it does **not** duplicate `…/draft`, which is
   only the draft summary). The `…/table-views` batch is actionable regardless.
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
