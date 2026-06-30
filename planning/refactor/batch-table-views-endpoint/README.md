---
DATE: 2026-06-29
TIME: 20:46 EDT
STATUS: Active — proposed refactor, not started. Ready to hand off.
AUTHOR: Claude (Opus 4.8)
SCOPE: Add a batch read endpoint for table-views so a page with N tables fetches
  all view/column configs in one request instead of N.
RELATED:
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md (Finding 2)
  - planning/refactor/production-frontend-performance/handoffs/step-2-equipment-fanout-investigation.md
---

# Batch the `table-views` read into one request

## Why this exists

The production perf baseline (2026-06-29) found the `equipment` page issues 19
backend GETs on one load — the chattiest route by far. Seven of those are
`GET …/projects/<p>/table-views/<type>`, one per equipment table type. The
companion investigation (`step-2-…`) asks a harder, still-open question about
the *data* fetches (`…/draft/tables/<type>`). **This refactor is the part that
needs no investigation:** the `table-views` fan-out is unambiguously batchable
and worth doing on its own.

This is a real, valid refactor — not premised on the mistaken "draft already has
everything" claim that the triage card originally carried (now corrected). It
stands regardless of how the data-path question resolves.

## What a table-view is (verified)

`backend/features/table_views/service.py` + `routes.py`:

- `GET /api/v1/projects/{project_id}/table-views/{table_key}` →
  `TableViewResponse { view_state_schema_version, view_state, updated_at }`.
- `view_state` is a per-(user, project, table_key) JSON blob holding column/view
  configuration (ordering, widths, visibility, etc.). One DB row per tuple,
  fetched via `repository.get(conn, user.id, project_id, table_key)`.
- It is **per-table by storage**, but there is nothing per-table about the
  *request*: fetching seven keys is seven independent single-row reads that
  could be one `WHERE table_key = ANY(%s)` query.

So the fan-out is purely a transport/round-trip artifact, not a data-model
constraint. Collapsing it is safe.

## Proposed change

Add a batch read alongside the existing per-key route (keep the single-key
route — `PUT`/`DELETE` and direct reads still use it):

- **Route:** `GET /api/v1/projects/{project_id}/table-views?keys=pumps,fans,…`
  → `BatchTableViewsResponse { views: dict[str, TableViewResponse] }` (key →
  config). Missing keys resolve to the same default-empty `TableViewResponse`
  the single-key route already returns for `row is None`, so the frontend sees
  identical semantics per key.
- **Service:** one function that validates each key (`validate_table_key`),
  then a single repository call returning all matching rows; assemble the dict,
  filling defaults for keys with no row.
- **Repository:** one parameterized `SELECT … WHERE user_id = %s AND
  project_id = %s AND table_key = ANY(%s)` (raw SQL, no ORM — house rule).
- **Frontend:** in `frontend/src/features/table_views/`, add a batch query hook
  the page calls once with all its table keys; have `createTableSliceFeature`
  read each table's config from that shared cached result instead of issuing a
  per-type `useTableView`. TanStack Query for server state.

## Blast radius

`createTableSliceFeature` (`frontend/src/features/project_document/table-slice.ts`)
is shared by every table-bearing page — equipment sub-tables, `spaces`,
`apertures`. So the same per-type `table-views` fan-out exists on those routes
too (the perf matrix shows `spaces` at 9 and `apertures` at 11 API calls). A
batch hook wired through the factory fixes all of them at once. That breadth is
the upside, but it also means the frontend change touches shared machinery —
test the equipment, spaces, and apertures pages after.

## Effort estimate

- **Backend:** small. One route + one service fn + one repository query + one
  Pydantic v2 response model. Mirror the existing single-key handlers; reuse
  `validate_table_key` and `_row_to_response`. ~half a day with tests.
- **Frontend:** small-to-medium. The endpoint is easy; the care is in routing
  every consumer through the shared batch hook without regressing per-table
  cache invalidation (the `view_state` cache must still update after a `PUT`).
  ~half to one day with the three-page smoke.
- **Risk:** low. Additive endpoint; the per-key route stays. Read-only path, no
  write-semantics change.

## Verification

1. Backend unit/integration test: batch endpoint returns one entry per requested
   key, defaults for absent rows, rejects malformed keys (`400 invalid_table_key`).
2. Re-run the read-only perf matrix (see the parent packet's `STATUS.md` for the
   command and the `project_prod_perf_fixture_runbook` memory for credentials)
   and confirm `equipment` drops from 19 → ~13 API calls (and `spaces`/`apertures`
   fall correspondingly). Payload is already tiny (~37 KB total), so the win is
   round-trip count, not bytes — most visible on high-latency links.
3. Manual: equipment, spaces, apertures pages still render column/view config
   correctly, and editing a column setting (`PUT`) still reflects immediately.

## Explicitly out of scope

- The `…/draft/tables/<type>` **data** fan-out — that is the open question in
  `step-2-equipment-fanout-investigation.md` (could one `GET …/document` replace
  the 7 per-table reads?) and must be decided separately before any change.
- Folding view-config into the draft-tables response — possible later, but it
  couples two concerns; the standalone batch endpoint is the cleaner first step.
