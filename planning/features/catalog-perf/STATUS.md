---
DATE: 2026-06-04
TIME: 11:30 ET
STATUS: Active — Phases 1 (gzip) and 2 (client-side `is_active`) shipped.
        Phase 3 (DataTable virtualization) next.
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
| 2 | Client-side `is_active` filter | Done | `main` (this commit) | all three catalog hooks unified; 1030 frontend tests pass |
| 3 | `DataTable` row virtualization | Pending | — | not yet measured |
| 4 | List payload trim | Pending | — | not yet measured |
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

## Next step

Phase 3 — `DataTable` row virtualization. See
`phases/phase-03-datatable-virtualization.md`. This is the largest
phase and the only one with a non-trivial regression risk across
`DataTable` consumers.

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
