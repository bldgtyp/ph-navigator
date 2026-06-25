---
DATE: 2026-06-24
TIME: 21:24 EDT
STATUS: Phase 04A first-cut delta captured
AUTHOR: Codex
SCOPE: Before/after evidence for the shared DataTable edit-churn first cut
RELATED:
  - ./STATUS.md
  - ./phases/phase-04a-datatable-edit-churn.md
  - ./scorecard-2026-06-24.md
---

# Frontend Perf Scorecard - Phase 04A Delta

## Run

- Stress fixture: `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Reproduction command:
  `cd frontend && PHN_PERF=1 PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts -g "spaces|equipment"`
- Reproduction result: filter still ran all 10 perf rows; 10/10 passed in 40.4s.
- Verification command:
  `cd frontend && PHN_PERF=1 PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498 E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm run test:e2e -- tests/e2e/perf/perf-matrix.spec.ts`
- Verification result: 10/10 passed in 38.5s.
- Focused regression:
  `cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts`
- Regression result: 5/5 passed.

## Change

Generic table-slice accepted writes now update the changed slice from the
mutation response and keep draft-summary invalidation synchronous, but sibling
editor table slices are invalidated with `refetchActiveSlices: false`. This
marks them stale without immediately refetching every mounted sibling DataTable
after one cell edit.

## Delta

| Page | Metric | Reproduced before | After first cut | Delta |
|---|---:|---:|---:|---:|
| Spaces Rooms stress edit | Scripted interaction | 1,986 ms | 1,505 ms | -481 ms |
| Spaces Rooms stress edit | Long tasks > 50 ms | 5 | 4 | -1 |
| Spaces Rooms stress edit | Max long task | 255 ms | 250 ms | -5 ms |
| Spaces Rooms stress edit | React update commits | 26 | 23 | -3 |
| Spaces Rooms stress edit | Actual render duration | 458.8 ms | 421.2 ms | -37.6 ms |
| Equipment Pumps stress edit | Scripted interaction | 3,159 ms | 1,647 ms | -1,512 ms |
| Equipment Pumps stress edit | Long tasks > 50 ms | 5 | 5 | 0 |
| Equipment Pumps stress edit | Max long task | 272 ms | 265 ms | -7 ms |
| Equipment Pumps stress edit | React update commits | 27 | 22 | -5 |
| Equipment Pumps stress edit | Actual render duration | 549.0 ms | 498.9 ms | -50.1 ms |

## Network Evidence

Before the change, a Rooms edit produced the accepted Rooms `PUT`, then sibling
`GET /draft/tables/space_types` and `GET /draft/tables/pumps`.

After the change, the Spaces stress edit produced initial table loads plus only
the accepted Rooms `PUT`; no post-edit sibling table GETs were recorded.

Before the change, a Pumps edit produced the accepted Pumps `PUT`, then sibling
GETs for Hot Water Heaters, Electric Heaters, Fans, Hot Water Tanks,
Ventilators, and Appliances.

After the change, the Equipment stress edit produced initial table loads plus
only the accepted Pumps `PUT`; no post-edit sibling Equipment table GETs were
recorded.

## Interpretation

The biggest confirmed stall was the accepted-write invalidation cascade, not a
single cell renderer. Removing eager sibling refetch roughly halves Equipment
edit time in the stress harness and materially improves Spaces edit time.

Remaining render churn is still visible: Spaces remains at 23 commits / 421.2
ms and Equipment remains at 22 commits / 498.9 ms. If Phase 04A continues,
inspect active DataTable derivation and inactive Equipment controller
construction next.
