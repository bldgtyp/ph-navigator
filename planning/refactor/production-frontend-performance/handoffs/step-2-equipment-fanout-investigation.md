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
- 5 × baseline (`/projects`, `/projects/deleted`, `/auth/session`,
  `/projects/<p>`, `…/draft`).

Total payload was small (~37 KB) and there was no jank, so this is **not urgent**.
It is a request-count / round-trip concern, not a render concern.

## The one question that decides the fix

**The full draft document is already fetched on the same load (`GET …/draft`),
and that document contains every table. So why does the equipment page also
fetch each table individually via `…/draft/tables/<type>`?**

Two possibilities, opposite fixes:

1. **The per-table fetches are redundant** — the data already arrived in the
   `…/draft` document. → Fix is frontend-only: read each table's rows from the
   already-cached draft instead of issuing per-type requests. Removes ~7
   requests per equipment load (and likely helps `spaces`/`apertures` too,
   which use the same slice machinery).

2. **The per-table endpoints are load-bearing** — they return something the
   draft does not (e.g. server-computed/normalized rows, pagination over large
   tables, or the row shape the editor binds to). → Then the data calls stay,
   but the **7 `table-views` calls** (column/view config) are the better target:
   consider a single batch endpoint returning all requested view configs, or
   folding view config into the draft-tables response.

Determine which world we are in **before** proposing a change.

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
- `backend/features/project_document/routes.py` — note both
  `GET …/draft` (whole document) and `GET …/draft/tables/{table_name}`
  (single table, `RegisteredTableResponse`). Compare what each returns.
- `backend/features/table_views/routes.py` +
  `backend/features/table_views/service.py` — what a table-view actually is and
  whether it is per-table by nature or batchable.

## What to determine and report

1. Does the `…/draft` document already contain the same table rows the
   `…/draft/tables/<type>` calls return? Quote the response shapes.
2. If yes: is there any reason the editor cannot bind to the draft-embedded
   rows (mutation/cache-invalidation coupling, row identity, etc.)?
3. What is a `table-view` and is it inherently per-table, or could one request
   return many? (Check the service + repository, not just the route.)
4. Recommend: (a) frontend-dedupe, (b) batch `table-views` endpoint, (c) leave
   as-is with justification. Include rough effort and blast radius (how many
   other pages share `createTableSliceFeature`).

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

A short written finding answering the question above, with a recommendation and
effort estimate, added to this packet (e.g. alongside this file or appended
here). No code change in this step.
