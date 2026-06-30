---
DATE: 2026-06-29
TIME: 20:40 EDT
STATUS: Investigation brief — not started. Reading task; no code change expected
  in this step.
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

**Could one `GET …/document` (whole doc, `ProjectDocumentV1`) replace the 7
`…/draft/tables/<type>` reads by slicing client-side — or do the per-table
endpoints earn their keep?**

Two possibilities, opposite fixes:

1. **The per-table data fetches could be collapsed into `…/document`** — fetch
   the whole document once and slice each table's rows out of it on the
   frontend, instead of issuing 7 per-type GETs. → Removes ~7 requests per
   equipment load (and likely helps `spaces`/`apertures`, which share the same
   slice machinery). **Caveat:** this couples the read path to the document
   shape and away from the per-table mutation/cache-invalidation path, so verify
   the editor can still bind/mutate correctly (see `table-slice.ts`).

2. **The per-table endpoints are load-bearing** — `table-slice.ts` keys fetch,
   preview-replace, custom-field mutation, and cache invalidation per
   `tableName`, so the per-table endpoints look like deliberate editor plumbing
   (the leading hypothesis). → Then the data calls stay, and the **7
   `table-views` calls** (pure per-table view/column config) are the better
   target: a single batch endpoint returning all requested view configs.

**Independent of which world we are in:** the 7 `…/table-views/<type>` calls are
pure per-(user, project, table) `view_state` JSON and are cleanly batchable. That
is the lowest-risk win and does not depend on resolving the data-path question —
see the dedicated refactor write-up referenced in the deliverable section.

Determine which world we are in **before** proposing a change to the data path.

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
- `backend/features/project_document/routes.py` — note the three relevant GETs
  and what each returns: `GET …/document` → `ProjectDocumentV1` (whole doc, all
  tables; **not fetched** by the equipment page), `GET …/draft` →
  `ProjectDraftSummary` (status/metadata only, no rows — this is the `…/draft`
  call the page *does* make), and `GET …/draft/tables/{table_name}` →
  `RegisteredTableResponse` (single table). Compare `…/document` vs the per-table
  responses — that is the data-path comparison that matters.
- `backend/features/table_views/routes.py` +
  `backend/features/table_views/service.py` — what a table-view actually is and
  whether it is per-table by nature or batchable.

## What to determine and report

1. Does `GET …/document` (`ProjectDocumentV1`) contain the same table rows the
   `…/draft/tables/<type>` calls return, in a shape the editor could bind to?
   Quote both response shapes. (Do **not** compare against `…/draft` — that is
   the summary and has no rows.)
2. If `…/document` could serve the read path: is there any reason the editor
   cannot bind to the document-embedded rows (mutation/cache-invalidation
   coupling, row identity, draft-vs-saved divergence, etc.)?
3. What is a `table-view` and is it inherently per-table, or could one request
   return many? (Check the service + repository, not just the route. Note: the
   batch case is already written up — see the deliverable section.)
4. Recommend: (a) collapse data reads into `…/document`, (b) batch `table-views`
   endpoint, (c) leave as-is with justification. Include rough effort and blast
   radius (how many other pages share `createTableSliceFeature`).

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
`planning/refactor/batch-table-views-endpoint/README.md`. Reference it rather
than re-deriving it; focus this step on the data path.
