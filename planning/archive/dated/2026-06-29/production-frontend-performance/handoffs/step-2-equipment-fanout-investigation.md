---
DATE: 2026-06-29
TIME: 20:40 EDT
STATUS: CLOSED (2026-06-29) — investigation done; both fan-out halves shipped/verified.
  table-views batch merged to main; draft-tables batch verified on branch
  `refactor/batch-draft-table-reads`
  (archived `planning/archive/dated/2026-06-29/batch-draft-table-reads/`).
  Equipment now issues 1 batch per surface instead of 7+7 per-table GETs.
AUTHOR: Claude (Opus 4.8)
SCOPE: Handoff for investigating the equipment page's API fan-out flagged in the
  Phase 04 production perf scorecard.
RELATED:
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-04-authenticated-readonly.md
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md
---

# Step 2 — Investigate the Equipment API Fan-Out

## You are picking this up cold — read this first

This is a **read-and-report** task. Do **not** change code, open a PR, or run
the production perf matrix. The deliverable is a written finding plus a
recommendation. Another step will implement whatever you conclude.

## Background (what we measured)

The production frontend perf baseline (2026-06-29) ran a read-only Playwright
matrix against `www.ph-nav.com` over a 250-row seeded fixture. Every route was
healthy — zero long tasks, loads ~0.24–0.32 s. **One route stood out for request
count: `equipment` issued 19 backend GETs in a single load**, versus 4–11 on
every other route. The breakdown (from the run's metrics JSON):

- 7 × `GET …/versions/<v>/draft/tables/<type>` — one per equipment table type
  (`pumps`, `fans`, `ventilators`, `hot_water_heaters`, `hot_water_tanks`,
  `electric_heaters`, `appliances`).
- 7 × `GET …/projects/<p>/table-views/<type>` — one per type (view/column config).
- 5 × baseline (`/auth/session`, `/projects`, `/projects/deleted`,
  `/projects/<p>`, and one `…/versions/<v>/draft`). **Note:** that last call is
  `GET …/draft` → `ProjectDraftSummary` (draft *status/metadata*: etags,
  `dirty_tables` name list, lock/`can_edit` flags), **not** the full document.
  The page does **not** fetch `GET …/document` (the whole-doc endpoint) on this
  load.

(The 7 + 7 + 5 = 19 breakdown is verified against the run's
`equipment-metrics.json`; the URL set is the ground truth quoted above.)

Total payload was small (~37 KB) and there was no jank, so this is **not urgent**.
It is a request-count / round-trip concern, not a render concern.

## The one question that decides the fix

> **Correction baked in:** an earlier version of this brief asked "the `…/draft`
> document already contains every table — why fetch each one again?" That premise
> was wrong and has been removed. The `…/draft` call on this load is
> `GET …/draft` → `ProjectDraftSummary` (status/metadata; **no rows**). The whole
> document lives at `GET …/document` → `ProjectDocumentV1`, which the equipment
> page **does not fetch**. So the 7 per-table data calls are not redundant with
> anything already loaded. The real question is below.

**Each `…/draft/tables/<type>` read re-assembles the whole draft server-side
(`get_draft_table_slice` → `get_current_document_view` →
`load_current_document_parts`) and returns one table. The data is co-located, so
the 7 reads waste round-trips *and* whole-draft loads. What is the safe way to
collapse them — and what must stay per-table?**

Two things this step must hold separate:

1. **What could be collapsed (the initial-mount fan-out).** The 7 GETs that fire
   when the page mounts could be replaced by **one batch/whole-*draft* read** that
   seeds each table's cache. → Removes ~6 round-trips + 6 redundant whole-draft
   server loads per mount (and helps `spaces`/`apertures`, which share the slice
   machinery). **The target is a new draft batch read, NOT `GET …/document`** —
   `…/document` returns the *saved* version (`ProjectDocumentV1`), which diverges
   from the draft once there are unsaved edits; there is no whole-*draft* GET
   today.

2. **What is load-bearing and must NOT regress.** PR #18
   (`equipment-draft-etag-coordination`, merged 2026-06-29) made the per-table
   cache split deliberate: all tables share one document-level draft etag; a
   write to any table invalidates every *other* table's cached slice
   (`applyAcceptedSlice` → `invalidateProjectDocumentEditorTableSlices`); and
   `resolveSliceForWrite` (`useSliceTableController.ts`) refetches a table fresh
   before its write so `If-Match` carries the current etag. That is the fix for
   "edit table A, navigate to B, B's edit is blocked," covered by
   `frontend/tests/e2e/.../table-draft-etag-coordination.spec.ts`. **A collapse
   may only remove the initial-mount fan-out via batch-seed; it must keep the
   per-table query + refetch-before-write machinery intact**, and that e2e spec
   is a hard regression gate.

Because this sits directly on the etag protocol the team just fixed, it is a
larger, riskier change than the table-views batch — **the table-views batch
(below) should land first.**

**Orthogonal, zero-coordination-risk win:** the 7 `…/table-views/<type>` calls
are pure per-(user, project, table) `view_state` JSON, unrelated to the draft
etag, and cleanly batchable — already written up and planned at
`planning/archive/dated/2026-06-29/batch-table-views-endpoint/`. Reference it; do not re-derive.

Confirm the load-bearing vs. wasteful split above **before** proposing any
data-path change.

## Where to look (concrete anchors)

Frontend:
- `frontend/src/features/project_document/table-slice.ts` — the shared
  `createTableSliceFeature` factory. Every table type (equipment sub-tables,
  spaces, apertures) instantiates this. Its `fetchSlice` / `useSliceQuery` is
  almost certainly what issues both the `draft/tables/<type>` and
  `table-views/<type>` requests. **Start here.**
- `frontend/src/features/equipment/` — `api.ts`, `hooks.ts`, `heat-pumps/`, and
  the table components. This is the page that instantiates the factory once per
  equipment type, producing the fan-out.
- `frontend/src/features/table_views/api.ts` — builds the
  `…/table-views/<tableKey>` URL.
- `frontend/src/features/project_document/` — where the full `…/draft` document
  query lives (find the draft-document query hook and what shape it returns).

Backend:
- `backend/features/project_document/routes.py` + `store.py` — note the GETs and
  what each returns: `GET …/document` → `ProjectDocumentV1` (whole **saved**
  doc; **not fetched** by the equipment page, and *not* the collapse target —
  saved ≠ draft), `GET …/draft` → `ProjectDraftSummary` (status/metadata only,
  no rows — this is the `…/draft` call the page *does* make), and
  `GET …/draft/tables/{table_name}` → `RegisteredTableResponse` (single table,
  but `store.get_draft_table_slice` loads the **whole draft** to produce it).
  There is **no** whole-*draft* read endpoint today — adding one (or a batch
  draft-tables read) is what a collapse would introduce.
- `backend/features/table_views/routes.py` +
  `backend/features/table_views/service.py` — what a table-view actually is and
  whether it is per-table by nature or batchable.

## What to determine and report

1. Can a new batch/whole-*draft* read reproduce each table's per-table
   `RegisteredTableResponse` exactly (row identity, custom-field schema,
   document-level etags) so seeded caches are indistinguishable from per-table
   fetches? Quote `get_draft_table_slice` / `contract.build_response` and a
   batch loop over the one already-loaded draft body.
2. Does the batch-seed design preserve PR #18's etag coordination end to end —
   per-table cache entries kept, invalidate-others on write kept, and
   `resolveSliceForWrite` still refetching a **single** table (not the batch)
   before a write? `table-draft-etag-coordination.spec.ts` must stay green.
3. Server cost: confirm a whole-draft read does ONE document load+validate vs
   the current 7, and measure.
4. Recommend: (a) batch-seed the draft reads (keeping the #18 protocol),
   (b) leave the data path as-is with justification. Include rough effort and
   blast radius (how many pages share `createTableSliceFeature`). The
   `table-views` batch is already decided and planned separately.

## Constraints / project rules

- All calculation/data logic stays in the **backend**; the frontend displays.
  A batch endpoint, if proposed, is a backend change with a narrow repository +
  Pydantic v2 model.
- Backend: `uv` only, raw parameterized SQL, strict typing (`ty`). Frontend:
  `pnpm` only, TanStack Query for server state. See `context/CODING_STANDARDS.md`
  and the area `.instructions.md` files.
- Evidence already on disk: the equipment run's per-route metrics are at
  `frontend/test-results/*/equipment-metrics.json` (gitignored; may be cleared —
  re-derive from the Phase 04 scorecard if gone). To re-measure, the fixture is
  seeded: `PERF_PROJECT_ID = ce77af67-8994-4174-89d6-a59e3bd6189e`,
  account `codex@testing.com`; see `STATUS.md` for the read-only matrix command
  and the memory `project_prod_perf_fixture_runbook` for credential handling.

## Deliverable

A short written finding answering the **data-path** question above (could
`GET …/document` replace the 7 `…/draft/tables/<type>` reads?), with a
recommendation and effort estimate, added to this packet (e.g. alongside this
file or appended here). No code change in this step.

The `table-views` batch half of the fan-out does **not** need this
investigation — it is already written up as a ready-to-hand-off refactor at
`planning/archive/dated/2026-06-29/batch-table-views-endpoint/README.md`. Reference it rather
than re-deriving it; focus this step on the data path.
