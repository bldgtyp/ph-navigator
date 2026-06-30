---
DATE: 2026-06-29
TIME: 19:08 EDT
STATUS: Phase 02 public anonymous baseline captured.
AUTHOR: Claude (Opus 4.8)
SCOPE: Credential-free production shell scorecard for www.ph-nav.com.
RELATED:
  - planning/refactor/production-frontend-performance/PLAN.md
  - planning/refactor/production-frontend-performance/STATUS.md
---

# Phase 02 - Public Anonymous Baseline Scorecard

## Run Metadata

- Target frontend: `https://www.ph-nav.com/`
- Target API: `https://api.ph-nav.com`
- Credentials: none (anonymous public shell).
- Browser: Playwright Chromium 1.60.0, headless, default viewport (1280x720).
- Network: real internet from the dev machine; no throttling applied.
- Method: cold pass uses a brand-new browser context (empty HTTP cache); warm
  pass reloads the same primed context. Browser-side timing only; Render API
  metrics not correlated this pass (per Phase 00 decision).
- Capture script: `working`/scratchpad `perf_public_baseline.mjs` (not committed;
  reproduce from the commands below).

## Layer 1 - Readiness And Headers (curl)

| Check | Result |
|---|---|
| `GET api.ph-nav.com/api/v1/ready` | `200`, `db:true`, `db_ms:4.03`, pool `requests_waiting:0`, total 0.41s, TTFB 0.41s |
| `GET www.ph-nav.com` (HTML shell) | `200`, `cf-cache-status: EXPIRED`→`HIT` when warm (age 24s), total 0.51s cold / 0.11s warm |
| `GET ph-nav.com` (apex) | `301` → `https://www.ph-nav.com/`, total 0.36s |

HTML shell cache policy: `cache-control: public, max-age=0, s-maxage=300`
(Cloudflare edge-caches for 5 min; confirmed HIT on repeat). Shell is tiny
(767 bytes; 429 bytes on the wire warm).

## Layer 2 - Browser Navigation Timing (Playwright)

| Metric | Cold | Warm |
|---|---|---|
| TTFB | 389 ms | 39 ms |
| DOMContentLoaded | 729 ms | 92 ms |
| Load | 729 ms | 93 ms |
| First Contentful Paint | 764 ms | 104 ms |
| Largest Contentful Paint | 764 ms | 104 ms |
| Long tasks | 0 (0 ms) | 0 (0 ms) |
| Resource count | 5 | 5 |
| Transfer total | 172.6 KB | 53.6 KB |

Reads cleanly: cold full load ~0.76 s to LCP with **zero long tasks** — the
public sign-in shell is light and the main thread is not blocked. Warm
navigation is ~0.10 s to LCP.

## Layer 3 - Static Asset Payload And Cache

Top resources (cold transfer, brotli on the wire / decoded):

| Asset | Wire | Decoded | Cold dur | Warm transfer |
|---|---|---|---|---|
| `index-TqKpo_OQ.js` | 97.0 KB | 301.2 KB | 301 ms | 300 B (304) |
| `index-D7peJxlw.css` | 21.9 KB | 130.8 KB | 301 ms | 300 B (304) |
| `Geist-300-latin.woff2` | 29.3 KB | 29.3 KB | 255 ms | **29.6 KB (full)** |
| `GeistMono-400-latin.woff2` | 23.1 KB | 23.1 KB | 238 ms | **23.4 KB (full)** |
| `GET /api/v1/auth/session` | 0 | 0 | 561 ms cold / 66 ms warm | — |

Edge caching works: on clean repeat requests all four static assets return
`cf-cache-status: HIT` in ~0.10-0.15 s. Brotli is applied to JS/CSS.

## Findings

1. **All content-hashed static assets are served `cache-control: max-age=0`
   (low confidence on intent, high confidence on effect).** Filenames already
   carry a content hash (`index-<hash>.js`, `Geist-300-latin-<hash>.woff2`), so
   they are the textbook case for `immutable, max-age=31536000`. With
   `max-age=0`, every navigation pays a per-asset revalidation round-trip:
   JS/CSS 304 cheaply (~300 B each) but the **two woff2 fonts re-download in
   full (~53 KB) on the warm pass** — that is essentially all of the 53.6 KB
   warm transfer. Long-lived immutable caching would make warm navigation cost
   ~0 network for statics. This is the single clear, low-risk optimization
   candidate for Phase 06. Where the header is set (Render static service vs.
   Cloudflare Cache Rule) needs confirmation before any change.

2. **JS decoded payload is 301 KB (97 KB brotli) for the public shell.** Not
   alarming and not blocking the main thread (0 long tasks), but it is the
   largest single download. Worth a route-level breakdown in Phase 04 to see
   how much of this is shared vendor vs. sign-in-specific.

3. **Cold `/api/v1/auth/session` took 561 ms** — the anonymous session probe is
   the slowest single request cold. Browser-only timing cannot attribute this
   to network vs. backend; revisit with Render correlation only if it recurs in
   the authenticated matrix.

No regressions or errors: `/ready` healthy, apex redirect correct, zero long
tasks, zero console-blocking behavior observed.

## Reproduce

```bash
# Layer 1
curl -fsS https://api.ph-nav.com/api/v1/ready
curl -sS -o /dev/null -D - https://www.ph-nav.com
curl -sS -o /dev/null -D - https://ph-nav.com

# Layer 3 cache headers
curl -sS -o /dev/null -D - https://www.ph-nav.com/assets/<hashed-asset>

# Layer 2 browser timing: cold + warm cold/warm contexts via Playwright Chromium
# (see scratchpad perf_public_baseline.mjs: addInitScript LCP+longtask observers,
#  new context = cold, reload = warm, collect navigation + resource timing).
```

## Next

- Phase 04 authenticated matrix is held pending fixture setup + explicit run
  approval (see `STATUS.md`).
- Carry Finding 1 (asset cache policy) into Phase 06 triage as the first
  candidate fix; verify the header origin before proposing a change.
