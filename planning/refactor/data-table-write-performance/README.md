---
DATE: 2026-07-09
TIME: -
STATUS: Active — packet revised per plan-review.md (R-1…R-10 + scope
  corrections resolved); awaiting Ed's ratification before phase-00/01
  implementation handoff.
AUTHOR: Claude (for Ed)
SCOPE: Router for the DataTable write-performance refactor packet:
  draft write coordinator + per-table optimistic journals, instant
  cursor advance, undo polish, honest conflict messaging, and
  measure-gated backend write-path trims — for the project-document
  slice-backed DataTables.
RELATED:
  - PRD.md (read first — revised contract)
  - plan-review.md (Codex review of record; resolved by this revision)
  - PLAN.md (sequencing + dependency map)
  - phases/phase-00 … phase-06
---

# DataTable Write Performance — Packet Router

## Problem (one paragraph)

Production data-entry outruns the write pipeline. Every slice-table
gesture is a blocking whole-table `PUT` guarded by `If-Match:
draft_etag`; the cursor waits on the full round-trip (the pause between
cells), and rapid gestures (Shift-Enter ×5) race each other's etags and
surface a false "draft changed in another tab" error. ⌘Z exists and is
bound but inherits the same blocking/racing pipeline and an 8-entry cap.

## Read order

1. `PRD.md` — revised findings F-1…F-16, goals, decisions D-1…D-13,
   acceptance criteria A-1…A-9.
2. `PLAN.md` — seven-phase sequencing and dependencies.
3. `phases/phase-NN-*.md` — one implementation handoff per phase.
4. `plan-review.md` — the Codex architecture review the revision
   resolves (historical context; its required corrections are folded
   into the PRD/phases).

## Phase map

| Phase | Title | Depends on | Ships user-visible |
|---|---|---|---|
| 00 | Observability + write-surface audit | — | Nothing (instrumentation) |
| 01 | Draft write coordinator (serialize) | 00 | Rapid entry stops erroring |
| 02 | Per-table optimistic journals | 01 | Cell-to-cell pause gone |
| 03 | Transport coalescing (conditional) | 02 | Faster drain/flush (if kept) |
| 04 | Undo polish | 01 (02 helps) | ⌘Z reliable + fast |
| 05 | Conflict copy + three-way retry | 01, 02 | Honest errors, fewer banners |
| 06 | Backend write-path trims | 00 metrics | Lower write latency (if gate passes) |

Recommended landing: 00 alone; 01+02 together; 03 (if kept), 04, 05,
06 individually. See PLAN.md.

## Boundaries

- Scope = the 14 **project-document slice-backed** DataTables
  (`createTableSliceFeature` / `useSliceTableController`). Catalog
  tables (row-level PATCH controllers) and the Aperture command grid
  are recorded follow-ups (PRD NG-4/NG-7).
- All frontend changes live in the shared layers — parent-owned per
  the DataTable-uniformity rule; no per-table opt-outs.
- The JSONB document model, draft model, and etag contract are
  unchanged (PRD NG-1); the semantic-command endpoint is a recorded,
  deferred alternative (PRD NG-2 / D-13b).
- The queue/optimistic/flush/rollback requirements are **pre-ratified**
  by `context/technical-requirements/data-table.md:517-528`; this
  packet is their implementation plan.

## Prior art

- `planning/archive/dated/2026-06-29/equipment-draft-etag-coordination/`
  — the refetch-before-write (`resolveSliceForWrite`) protocol this
  packet extends.
- `useGridHistory` / `useGridWriteReducer` — undo plumbing already on
  main; phase-04 polishes rather than builds.
- Aperture command endpoint — prior art for the deferred
  semantic-command transport (PRD NG-2).
