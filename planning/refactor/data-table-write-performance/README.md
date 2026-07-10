---
DATE: 2026-07-09
TIME: -
STATUS: Active — plan review complete; packet revisions required before
  implementation handoff.
AUTHOR: Claude (for Ed)
SCOPE: Router for the DataTable write-performance refactor packet:
  serialize + coalesce table writes, optimistic apply with instant
  cursor advance, undo polish, honest conflict messaging, and
  measure-gated backend write-path trims.
RELATED:
  - plan-review.md (read first; required corrections before implementation)
  - PRD.md (draft contract under review)
  - PLAN.md (sequencing + dependency map)
  - phases/phase-01 … phase-05
---

# DataTable Write Performance — Packet Router

## Problem (one paragraph)

Production data-entry outruns the write pipeline. Every DataTable
gesture is a blocking whole-table `PUT` guarded by `If-Match:
draft_etag`; the cursor waits on the full round-trip (the pause between
cells), and rapid gestures (Shift-Enter ×5) race each other's etags and
surface a false "draft changed in another tab" error. ⌘Z exists and is
bound but inherits the same blocking/racing pipeline and an 8-entry cap.

## Read order

1. `plan-review.md` — architecture review and required packet corrections;
   implementation is gated on resolving R-1…R-10.
2. `PRD.md` — findings (with file:line evidence), goals, decisions
   D-1…D-11, acceptance criteria.
3. `PLAN.md` — phase sequencing, dependencies, what ships when.
4. `phases/phase-NN-*.md` — one implementation handoff per phase; each
   is self-contained enough to hand to an implementation agent along
   with the PRD.

## Phase map

| Phase | Title | Depends on | Ships user-visible |
|---|---|---|---|
| 01 | Per-table write queue + coalescing | — | Rapid entry stops erroring |
| 02 | Optimistic apply + instant cursor advance | 01 | Cell-to-cell pause gone |
| 03 | Undo/redo polish (capacity, coverage, safety) | 01 (02 helps) | ⌘Z reliable + fast |
| 04 | Honest conflict messaging + one-shot self-heal | 01 | Accurate errors, fewer banners |
| 05 | Backend write-path trims (measure-gated) | none (gated by 01+02 metrics) | Lower write latency |

## Boundaries

- All frontend changes live in the shared layers (`data-table` library,
  `useSliceTableController`, `table-slice.ts`) — parent-owned per the
  DataTable-uniformity rule; no per-table opt-ins.
- Aperture grid (command-endpoint path `POST /apertures/command`) is
  **out of scope** for phases 01–04; noted as follow-up in the PRD.
- Backend document model (single JSONB blob per version/draft) is
  **not** being redesigned (reaffirmed 2026-06-24 data-architecture
  review).

## Prior art

- `planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/`
  — introduced the refetch-before-write (`resolveSliceForWrite`)
  protocol this packet extends.
- `useGridHistory` / `useGridWriteReducer` — undo plumbing already on
  main; phase 03 polishes rather than builds.
