---
DATE: 2026-06-04
TIME: 08:00 ET
STATUS: REVIEW — performance review of the Materials Catalog page
        (`/catalog/materials`). No code changes. The page feels sluggish
        because (a) the `DataTable` body has no row virtualization and
        renders all 410 rows × 11 cells = 4,510 `<td>` elements every
        time it re-renders, and (b) the backend does not gzip
        responses, so a 197 KB payload goes uncompressed when it would
        compress to ~12 KB. Backend itself is healthy (~25 ms
        end-to-end). Toggling "Show deactivated" reproduces the
        sluggishness as a ~1,970 ms render.
AUTHOR: Claude (Opus 4.7)
REVIEWED: `frontend/src/features/catalogs/**` + `frontend/src/shared/ui/data-table/**`
          + `backend/features/catalogs/materials/**` + `backend/main.py`
          + `backend/features/auth/service.py`. Live profiling against
          `localhost:5173` + `localhost:8000` with 410 active materials
          via the Chrome DevTools MCP.
SCOPE: Profiling + code review only. No implementation changes.
RELATED:
  - backend/main.py (no GZipMiddleware)
  - backend/features/catalogs/materials/routes.py (unbounded list)
  - backend/features/catalogs/materials/service.py
  - backend/features/catalogs/materials/repository.py
  - backend/features/catalogs/materials/models.py (audit fields in list payload)
  - backend/features/auth/service.py (3-query auth pipeline per request)
  - frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
  - frontend/src/features/catalogs/hooks.ts (refetch on includeInactive)
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - working/perf-review/materials-response.network-response (197,304 byte sample)
---

# Materials Catalog — Performance Review

## TL;DR

The page is genuinely sluggish. Backend is fast (~25 ms). The
sluggishness comes from **two large multipliers on the frontend** plus
**two free wins on the backend**:

| # | Finding | Severity | Effort | Impact |
|---|---|---|---|---|
| 1 | No row virtualization — 410 rows × 11 cells = 4,510 cells in DOM | **High** | Medium | ~2 s → ~100 ms on toggle |
| 2 | No `GZipMiddleware` — 193 KB JSON sent uncompressed | **High** | Trivial | 193 KB → ~12 KB |
| 3 | No pagination / always returns the whole catalog | Med (now), High (future) | Medium | Caps the table at whatever the DB has |
| 4 | Two payload fields the UI never uses (`created_by`, `updated_by` UUIDs) | Low | Trivial | -10–15% payload |
| 5 | Auth pipeline does 3 SQL round-trips per request (session `SELECT FOR UPDATE` + user + touch `UPDATE`) | Med | Med | -3–8 ms per API call, also reduces lock contention |
| 6 | Re-fetch on `includeInactive` toggle (full second 197 KB request just to add 3 inactive rows) | Med | Low | Eliminates the second request |

## Live measurements

Captured against the real app, 410 active materials, no throttling,
local dev:

- **Page LCP**: 257 ms ✅ (render delay 253 ms is fine for a non-image LCP element)
- **Materials API turnaround**: 18–32 ms server-side ✅ — backend itself is **not** the problem
- **JSON payload**: **197,304 bytes uncompressed**; `gzip -kc` of the same body is **12,371 bytes** (93.7% saving)
- **Response headers**: `content-length: 197304`, **no `content-encoding`**, no `cache-control`, no `etag` — server ignores the client's `Accept-Encoding: gzip, deflate, br, zstd`
- **DOM**: 9,236 total elements, 410 `<tr>` + 4,510 `<td>` under `<tbody>`, scrollable height **15,500 px** in a 794 px viewport (~21 rows visible, 19× over-render). Outer `document.documentElement.outerHTML` is **1.25 MB serialized**.
- **Style recalc**: 47 ms touching 9,385 elements (Chrome's DOMSize insight is triggered)
- **Toggle "Show deactivated" → first paint**: **~1,970 ms** (the smoking gun for the perceived sluggishness)
- **Click latency on a mid-table cell**: 130–360 ms in the worst cases
- **JS heap**: 45.9 MB (modest, not a concern)

## Findings & recommendations

### 1. No row virtualization (HIGH) — `frontend/src/shared/ui/data-table/DataTable.tsx`, `components/GridBody.tsx`

`GridBody` renders every row from `bodyPlan` straight into the DOM —
no `react-window` / `react-virtual` / TanStack Virtualizer. At 410
rows × 11 cells that's **4,510 `<td>` elements**, each with
selection/edit/fill listeners and per-cell state checks (`selected`,
`editing`, `isFillTarget`, `axisTint`, etc.). Any state change at the
table level (active cell, edit start, selection) walks the full
subtree.

This is the #1 contributor to the **1,970 ms toggle latency**: when
`useMaterialsQuery` returns the new `items` array, React rebuilds 410
rows in one go. The same thing happens on sort / filter / group
changes.

**Recommendation:** Add row virtualization for the body. TanStack
Virtual integrates cleanly with TanStack Table (already a dependency).
Target ~30 rendered rows instead of 410 → ~13× fewer DOM nodes and
dramatically smaller style-recalc cost. Frozen columns + group headers
complicate this — worth its own design pass.

### 2. No gzip on API responses (HIGH) — `backend/main.py`

The response is 197 KB on the wire; gzip would shrink it to ~12 KB.
The client already sends `Accept-Encoding: gzip, deflate, br, zstd`.
Server returns no `content-encoding`.

**Recommendation:** Add `GZipMiddleware`:
```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```
One line. Helps every JSON endpoint, not just materials. (Brotli via
`brotli-asgi` is even smaller if you want to go further.)

### 3. No pagination / unbounded list (MED, will become HIGH) — `backend/features/catalogs/materials/routes.py:49`, `service.py:29`, `repository.py:55`

`GET /catalogs/materials` returns **every** active material. The
catalog already has 410 rows. Once it grows (say, after import
sweeps), payload and render times grow linearly with no ceiling.
Frontend filtering happens in-memory in `DataTable`, so the wire
payload is the bottleneck.

**Recommendation:** Add `?limit&offset` (or cursor) params and switch
the frontend to `useInfiniteQuery` or server-side paging when row
count exceeds a threshold. Lower priority than #1/#2 since current
count is small, but it's the right shape for the API regardless.

### 4. Payload includes fields the table never displays (LOW) — `backend/features/catalogs/materials/models.py:47–75`

`CatalogMaterialPublic` returns `created_by` and `updated_by` UUIDs
that the page (`MaterialsCatalogPage.tsx`) and column defs never
reference. UUID strings cost ~50 bytes each × 2 fields × 410 rows ≈
40 KB of the payload — 20% before compression. Same logic for
`created_at`/`updated_at` if not surfaced.

**Recommendation:** Slim a list-response model down to columns
actually shown; expose audit fields on a per-row detail endpoint
(`GET /catalogs/materials/{id}`).

### 5. Auth middleware does 3 DB round-trips per request (MED) — `backend/features/auth/service.py:169–218`

Every authenticated request — including the catalog GET — does
`SELECT … FOR UPDATE` on `sessions`, a `SELECT` on `users`, then an
`UPDATE` to touch the session. With a fast local DB this is ~3–8 ms,
but it's pure overhead, takes a row lock, and scales poorly under
concurrency.

**Recommendation:** Either (a) move `touch_session` to a
deferred/background task per request, or (b) only touch the session
every N seconds (e.g. if `last_seen_at` is older than 60 s). The
`FOR UPDATE` lock is overkill if all you're doing is updating
`last_seen_at`. Out of scope for this catalog perf review but worth
flagging since it sits on every catalog page load.

### 6. The "Show deactivated" toggle round-trips a full second 197 KB list (MED) — `frontend/src/features/catalogs/hooks.ts:34–41`

`useMaterialsQuery(includeInactive)` keys on `includeInactive`, so
flipping the checkbox issues a new fetch instead of locally filtering
an `is_active` flag that's already in the cached payload.

**Recommendation:** Always fetch `include_inactive=true` once and let
the client filter the rows by `is_active` based on the checkbox. The
data is in the response either way; you're paying for a second 197 KB
request to add 3 rows. (Or, with virtualization in place, this
becomes a non-event.)

## Smaller observations

- **React Query defaults are fine** (`frontend/src/app/query-client.ts`):
  `staleTime: 15s`, `refetchOnWindowFocus: false`, `retry: false`. No
  tab-focus thrash.
- **No `Cache-Control` / `ETag`** on the materials GET. A short
  max-age + ETag would skip the 197 KB body on repeated visits within
  a session.
- **StrictMode double-fetch shows up as `net::ERR_ABORTED` pairs** in
  dev — that's React StrictMode + a properly wired AbortSignal,
  harmless in dev, won't appear in prod build.
- **`MaterialsCatalogPage.tsx:138–195` `useMemo`s + `isActiveById`
  `Map`** are well-done — the page itself doesn't re-render
  gratuitously. The cost is downstream in `DataTable`.
- **Dev build noise**: measurement was against `vite dev` with ~350
  module requests for the route — production bundle will load in a
  single HTTP/2 chunk and won't have this profile. **Don't fix
  anything based on the dev request count.**
- **Single-row ORDER BY index is fine**: the partial index
  `ix_catalog_materials_active_name` on `(name)` covers the WHERE +
  ORDER BY; tiebreaker on `id` is cheap at this scale.

## Suggested ordering

1. **Add `GZipMiddleware`** — one-line, ships today, ~94% wire
   reduction. Won't fix render, but the toggle / refetch becomes
   ~12 KB instead of 197 KB, which helps remote users.
2. **Drop the refetch on `includeInactive` toggle** — small change,
   removes one of the two visible "stalls".
3. **Add row virtualization to `DataTable`** — biggest single win for
   perceived snappiness; this is what fixes the 2-second toggle and
   the laggy click.
4. **Then:** trim audit fields from the list payload, add pagination,
   defer session-touch.

## Profile artifacts

- `working/perf-review/materials-response.network-response` — 197,304-byte
  sample of the materials list response (uncompressed body).
- `working/perf-review/materials-inactive-response.network-response` —
  same endpoint with `?include_inactive=true`, 198,570 bytes.

Both are gitignored under `working/`.
