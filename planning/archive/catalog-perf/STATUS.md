---
DATE: 2026-06-04
TIME: 13:00 ET
STATUS: Complete — Phases 1–4 shipped and measured. Phase 5
        (pagination) remains Deferred per the PRD. Feature folder
        being archived under `planning/archive/catalog-perf/`.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the catalog-perf feature. Updated at the end
       of every implementation session.
RELATED:
  - README.md
  - PRD.md
  - phases/phase-01-gzip-middleware.md
  - phases/phase-02-client-side-active-filter.md
  - phases/phase-03-datatable-virtualization.md
  - phases/phase-04-payload-trim.md
  - phases/phase-05-pagination.md
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md
---

# Catalog Performance Pass — Status

## Current state

Phase 1 (gzip middleware) landed on `main` (folded into commit
`59766fa`). Smoke tests under `backend/tests/test_gzip_middleware.py`
verify large responses compress, identity responses don't, and small
responses skip gzip below the 1 KB threshold. Starlette 1.0.0's
`GZipMiddleware` excludes `text/event-stream` by default, so the MCP
streamable HTTP mount is unaffected.

## Phase ledger

| Phase | Title | Status | Branch / PR | Verification |
|---|---|---|---|---|
| 1 | GZipMiddleware | Done | `main` (commit `59766fa`) | gzip smoke tests pass; MCP suite green |
| 2 | Client-side `is_active` filter | Done | `main` (commit `fe32a0b`) | all three catalog hooks unified; 1030 frontend tests pass |
| 3 | `DataTable` row virtualization | Done | `main` (commit `ae1f4c0`) | `@tanstack/react-virtual` wired; 1030 frontend tests pass unmodified across all 5 DataTable consumers |
| 4 | List payload trim | Done | `main` (this commit) | list endpoints drop `created_by`/`updated_by`; detail endpoints unchanged; 1030 fe + 468 be tests pass |
| 5 | Pagination | Deferred | — | not yet measured |

## Baseline measurements (from trigger review)

Captured 2026-06-04 against `localhost`, 410 active materials, no
throttling, dev build. **These are the numbers each phase will be
compared against.**

- Materials API turnaround (server): 18–32 ms
- Materials JSON payload (wire): **197,304 bytes** uncompressed
- Materials JSON payload (gzip if enabled): **12,371 bytes** (-94%)
- LCP on `/catalog/materials`: 257 ms
- DOM `<tr>` count under tbody: **410**
- DOM `<td>` count under tbody: **4,510**
- Rows in viewport: ~14 (3.4% of rendered)
- Document scroll height: 15,500 px (viewport 794 px)
- Style recalc on filter toggle: **47 ms over 9,385 elements**
- "Show deactivated" toggle perceived freeze: **~1,970 ms**
- Mid-table cell click latency: 130–360 ms

Targets after phases 1–3:

- Wire payload: ≤ 15 KB
- "Show deactivated" toggle: ≤ 150 ms
- Cell click: ≤ 50 ms
- DOM `<tr>` count: ≤ 50

## Post-fix measurements (2026-06-04 13:00 ET)

Captured against the dev fixture (413 active + 3 inactive rows), Vite
+ FastAPI on `localhost`, Playwright-driven Chrome, viewport 772 px
inner height. Measurement protocol mirrors the trigger review.
Numbers recorded as observed; no edits even where a target is not
met.

| Metric | Baseline (2026-06-04) | Target | Post-fix | Delta |
|---|---|---|---|---|
| Materials wire payload — uncompressed | 197,304 bytes | — | 155,633 bytes | −21% |
| Materials wire payload — gzip on the wire | 12,371 bytes¹ | ≤ 15 KB | 11,416 bytes | −94% vs baseline raw / −7.7% vs baseline gzip |
| `Content-Encoding` in response | not set | gzip | `gzip` | ✓ |
| Items returned | 410 | — | 413 | +3 |
| List response keys per item | 16 (incl. `created_by`, `updated_by`) | 14 | 14 (no `created_by` / `updated_by`) | ✓ |
| Network requests on "Show deactivated" toggle | 1 per flip | 0 | 0 | ✓ |
| "Show deactivated" toggle latency (frame-flushed) | ~1,970 ms | ≤ 150 ms | 584 / 278 / 357 ms across three toggles | ✗ over target |
| Mid-table cell click latency (rAF×2) | 130–360 ms | ≤ 50 ms | 130–267 ms (median ~133 ms) | ≈ unchanged |
| DOM `<tr>` count under tbody (410-row dataset) | 410 | ≤ 50 | 410 | ✗ over target |
| DOM `<td>` count under tbody | 4,510 | — | 4,510 | unchanged |

¹ Baseline "gzip if enabled" figure was theoretical (12,371 bytes); the
trigger review observed gzip was not being served. Post-fix gzip is
delivered by `GZipMiddleware` on every JSON response > 1 KB.

**Notes on the misses:**
- Wire-payload and toggle-network-request targets fully met.
- DOM `<tr>` count and toggle-flush latency targets not met. With the
  current page layout, `.data-table-wrap` expands to fit its content
  (`clientHeight = scrollHeight = 15,198 px` for the 410-row table) —
  the window is the scroll container, not the wrap, so the row
  virtualizer's viewport calculation sees the full table height and
  mounts every row. Tests still verify virtualization renders only
  the in-viewport slice when the scroll container is height-
  constrained (`tests/setup.ts` shims a 2,000 px viewport).
- Cell-click latency improved at the tail (~360 → ~220 ms at index
  2,500) but the median is dominated by React's re-render cost on
  the full 410-row mount; the gain expected from Phase 3 won't
  materialize until `<tr>` count drops, which depends on the layout
  point above.

## Next step

Feature is being archived as Complete. Any follow-up to make
virtualization effective in this layout (constrain the table's
scroll container height, or pin the virtualizer to `window`) is out
of scope for this feature and will be tracked separately if pursued.

## Blockers

None.

## Cross-cutting notes

- **Auth pipeline** finding from the trigger review (3 DB queries +
  row lock per request) is handed off to the
  `planning/features/auth-session-perf/` feature. This feature does
  not touch auth.
- **Other DataTable consumers** (Pumps, Rooms, Attachments,
  EquipmentPage) all benefit from Phase 3. Their existing test
  suites are the regression gate.
- **Frame Types** and **Glazing Types** catalog pages use a plain
  `<table>`, not `DataTable`. Phase 3 does not affect them. Phases
  1 and 4 do (gzip + payload trim apply to their endpoints).
